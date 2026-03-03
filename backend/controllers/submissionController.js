const fs = require("fs");
const axios = require("axios");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const ResubmissionRequest = require("../models/ResubmissionRequest");
const Classroom = require("../models/Classroom");
const User = require("../models/User");
const { uploadPdfBuffer, cloudinary } = require("../services/cloudinary");
const gradingQueue = require("../queues/gradingQueue");

const RESULT_VISIBILITY = {
    IMMEDIATE: "IMMEDIATE",
    AFTER_DEADLINE: "AFTER_DEADLINE",
    AFTER_REVIEW: "AFTER_REVIEW",
};

const PDF_DOWNLOAD_TIMEOUT_MS = 20000;
const PDF_DOWNLOAD_RETRIES = 2;
function getStudentMimeType(file) {
    if (file && file.mimetype) {
        return file.mimetype;
    }
    return "application/pdf";
}

function getStudentUploadFormat(file) {
    const mimeType = getStudentMimeType(file);
    if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return "docx";
    }
    if (mimeType === "application/msword") {
        return "doc";
    }
    return "pdf";
}

function isResultVisibleToUser(submission, assignment, userRole) {
    if (userRole !== "STUDENT") {
        return true;
    }
    if (!assignment) {
        return true;
    }
    const visibility = assignment.resultVisibility || RESULT_VISIBILITY.IMMEDIATE;
    if (visibility !== RESULT_VISIBILITY.AFTER_DEADLINE) {
        if (visibility === RESULT_VISIBILITY.AFTER_REVIEW) {
            return Boolean(submission?.reviewedByStaffAt);
        }
        return true;
    }
    if (!assignment.dueDate) {
        return true;
    }
    const dueDateTime = new Date(assignment.dueDate).getTime();
    if (Number.isNaN(dueDateTime)) {
        return true;
    }
    return Date.now() >= dueDateTime;
}

function buildSubmissionResponse(submission, assignment, userRole) {
    const resultVisible = isResultVisibleToUser(submission, assignment, userRole);
    const visibilityPolicy = assignment?.resultVisibility || RESULT_VISIBILITY.IMMEDIATE;
    if (!submission) {
        return { submission: null, resultVisible, visibilityPolicy };
    }

    const submissionObject =
        submission && typeof submission.toObject === "function" ? submission.toObject() : submission;

    if (resultVisible) {
        return { submission: submissionObject, resultVisible: true, visibilityPolicy };
    }

    return {
        submission: {
            ...submissionObject,
            grade: null,
            feedback: "",
            gradedAt: null,
        },
        resultVisible: false,
        visibilityPolicy,
    };
}

async function canManageSubmissionForClassroom(userId, userRole, classroomId) {
    if (!userId || !userRole) {
        return false;
    }
    if (userRole === "ADMIN") {
        return true;
    }
    if (userRole !== "TEACHER" && userRole !== "ASSISTANT") {
        return false;
    }

    const classroom = await Classroom.findById(classroomId).select("teacherId assistantIds");
    if (!classroom) {
        return false;
    }

    if (userRole === "TEACHER") {
        return classroom.teacherId?.toString() === userId.toString();
    }
    return classroom.assistantIds.some((id) => id.toString() === userId.toString());
}

async function ensureStaffCanManageClassroom(userId, userRole, classroomId) {
    const allowed = await canManageSubmissionForClassroom(userId, userRole, classroomId);
    if (!allowed) {
        throw new Error("FORBIDDEN_CLASSROOM");
    }
}

function parseCloudinaryAsset(urlString) {
    try {
        const url = new URL(urlString);
        const parts = url.pathname.split("/").filter(Boolean);
        const rawIndex = parts.findIndex((p) => p === "raw");
        if (rawIndex === -1) return null;

        const type = parts[rawIndex + 1] || "upload";
        let publicIdParts = parts.slice(rawIndex + 2);
        if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
            publicIdParts = publicIdParts.slice(1);
        }
        if (!publicIdParts.length) return null;

        return { type, publicId: publicIdParts.join("/") };
    } catch {
        return null;
    }
}

function getPublicIdCandidates(publicId) {
    if (!publicId) return [];
    const withExt = /\.pdf$/i.test(publicId) ? publicId : `${publicId}.pdf`;
    const withoutExt = publicId.replace(/\.pdf$/i, "");
    return Array.from(new Set([withExt, withoutExt]));
}

async function getPdfBuffer(source, fallbackBuffer) {
    if (fallbackBuffer && source == null) {
        return fallbackBuffer;
    }

    if (typeof source === "string" && /^https?:\/\//i.test(source)) {
        const isTimeoutOrNetworkError = (err) => {
            const code = err?.code;
            const status = err?.response?.status;
            return (
                code === "ETIMEDOUT" ||
                code === "ECONNABORTED" ||
                code === "ECONNRESET" ||
                code === "ENOTFOUND" ||
                code === "EAI_AGAIN" ||
                !status
            );
        };

        const shouldUseCloudinarySignedFallback = (err) => {
            const status = err?.response?.status;
            return Boolean(
                source.includes("res.cloudinary.com") &&
                ((status && [401, 403, 404].includes(status)) || isTimeoutOrNetworkError(err))
            );
        };

        const fetchWithRetry = async(url, retriesLeft = PDF_DOWNLOAD_RETRIES) => {
            try {
                const response = await axios.get(url, {
                    responseType: "arraybuffer",
                    timeout: PDF_DOWNLOAD_TIMEOUT_MS,
                });
                return Buffer.from(response.data);
            } catch (err) {
                if (retriesLeft > 0 && isTimeoutOrNetworkError(err)) {
                    return fetchWithRetry(url, retriesLeft - 1);
                }
                throw err;
            }
        };

        try {
            return await fetchWithRetry(source);
        } catch (err) {
            if (shouldUseCloudinarySignedFallback(err)) {
                const cloudinaryAsset = parseCloudinaryAsset(source);
                if (cloudinaryAsset) {
                    let lastError = err;
                    const candidates = getPublicIdCandidates(cloudinaryAsset.publicId);

                    for (const candidate of candidates) {
                        try {
                            const signedUrl = cloudinary.utils.private_download_url(
                                candidate,
                                "pdf", {
                                    resource_type: "raw",
                                    type: cloudinaryAsset.type,
                                    expires_at: Math.floor(Date.now() / 1000) + 300,
                                }
                            );
                            return await fetchWithRetry(signedUrl);
                        } catch (candidateErr) {
                            lastError = candidateErr;
                        }
                    }

                    throw lastError;
                }
            }

            throw err;
        }
    }

    if (typeof source === "string") {
        return fs.readFileSync(source);
    }

    if (fallbackBuffer) {
        return fallbackBuffer;
    }

    throw new Error("Unable to read PDF");
}

exports.submitAssignment = async(req, res) => {
    try {
        const { assignmentId } = req.body;
        const studentId = req.user?.userId;

        if (req.user?.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can submit assignments" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Student PDF missing" });
        }
        if (!req.file.buffer && !req.file.path) {
            return res.status(400).json({ message: "Invalid PDF upload" });
        }

        if (!req.file.buffer) {
            return res.status(400).json({ message: "Invalid PDF upload" });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
            return res.status(400).json({ message: "Submission is closed. The due date has passed." });
        }

        const existingSubmission = await Submission.findOne({
            assignmentId,
            studentId,
        }).sort({ submittedAt: -1 });

        const latestRequest = await ResubmissionRequest.findOne({
            assignmentId,
            studentId,
        }).sort({ createdAt: -1 });

        if (
            existingSubmission &&
            (!latestRequest ||
                latestRequest.status !== "APPROVED" ||
                latestRequest.used)
        ) {
            const responsePayload = buildSubmissionResponse(existingSubmission, assignment, req.user?.role);
            return res.status(200).json({
                submission: responsePayload.submission,
                resultVisible: responsePayload.resultVisible,
                visibilityPolicy: responsePayload.visibilityPolicy,
                alreadySubmitted: true,
                resubmissionRequest: latestRequest || null,
            });
        }

        const studentUploadFormat = getStudentUploadFormat(req.file);
        const uploadedSubmission = await uploadPdfBuffer(
            req.file.buffer,
            "sa7a7ly/submissions",
            studentUploadFormat
        );

        const submission = await Submission.create({
            assignmentId,
            studentId,
            pdfPath: uploadedSubmission.secure_url,
            submittedBy: studentId,
            submittedByRole: "STUDENT",
            status: "QUEUED",
        });
        console.log(`[SubmissionFlow] saved (student): submissionId=${submission._id} assignmentId=${assignmentId}`);

        if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
            latestRequest.used = true;
            latestRequest.usedAt = new Date();
            await latestRequest.save();
        }

        const classroom = await Classroom.findById(assignment.classroomId).select("teacherId");
        const teacherId =
            classroom?.teacherId?.toString() ||
            assignment.createdBy?.toString() ||
            null;
        let queuedJob;
        try {
            queuedJob = await gradingQueue.addGradingJob({
                submissionId: submission._id.toString(),
                teacherId,
            });
        } catch (queueErr) {
            await Submission.findByIdAndUpdate(submission._id, {
                $set: {
                    status: "FAILED_PERMANENT",
                    feedback: `Queueing failed: ${queueErr.message || "Unknown queue error"}`,
                },
            }).catch(() => null);
            throw queueErr;
        }
        console.log(
            `[SubmissionFlow] queued (student): submissionId=${submission._id} jobId=${queuedJob?.id || "n/a"}`
        );

        const responsePayload = buildSubmissionResponse(submission, assignment, req.user?.role);
        console.log(`[SubmissionFlow] response sent (student): submissionId=${submission._id}`);

        return res.status(201).json({
            submission: responsePayload.submission,
            resultVisible: responsePayload.resultVisible,
            visibilityPolicy: responsePayload.visibilityPolicy,
            alreadySubmitted: false,
            resubmissionRequest: latestRequest || null,
        });
    } catch (err) {
        console.error(
            "SUBMISSION ERROR:",
            err && err.response && err.response.data ?
            err.response.data :
            err
        );

        return res.status(500).json({
            message: err &&
                err.response &&
                err.response.data &&
                err.response.data.error ?
                err.response.data.error.message : err.message,
        });
    }
};

// Submit on behalf (teacher/assistant)
exports.submitAssignmentOnBehalf = async(req, res) => {
    try {
        const { assignmentId, studentId, studentName, submittedBy } = req.body;
        const normalizedStudentName = (studentName || "").trim();

        if (!req.file) {
            return res.status(400).json({ message: "Student PDF missing" });
        }
        if (!assignmentId || !submittedBy || (!studentId && !normalizedStudentName)) {
            return res.status(400).json({
                message: "assignmentId, submittedBy, and studentName are required",
            });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        const classroom = await Classroom.findById(assignment.classroomId);
        if (!classroom) {
            return res.status(404).json({ message: "Classroom not found" });
        }

        const staff = await User.findById(submittedBy);
        if (!staff || (staff.role !== "TEACHER" && staff.role !== "ASSISTANT")) {
            return res.status(403).json({ message: "Only teacher or assistant can submit on behalf" });
        }

        const isTeacher = staff.role === "TEACHER" && classroom.teacherId.toString() === staff._id.toString();
        const isAssistant = staff.role === "ASSISTANT" &&
            classroom.assistantIds.some((id) => id.toString() === staff._id.toString());

        if (!isTeacher && !isAssistant) {
            return res.status(403).json({ message: "Not allowed to submit in this classroom" });
        }

        if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
            return res.status(400).json({ message: "Submission is closed. The due date has passed." });
        }

        const existingSubmission = studentId ?
            await Submission.findOne({ assignmentId, studentId }).sort({ submittedAt: -1 }) :
            null;

        const latestRequest = studentId ?
            await ResubmissionRequest.findOne({ assignmentId, studentId }).sort({ createdAt: -1 }) :
            null;

        if (
            existingSubmission &&
            (!latestRequest ||
                latestRequest.status !== "APPROVED" ||
                latestRequest.used)
        ) {
            return res.status(200).json({
                submission: existingSubmission,
                alreadySubmitted: true,
                resubmissionRequest: latestRequest || null,
            });
        }

        const studentUploadFormat = getStudentUploadFormat(req.file);
        const uploadBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (!uploadBuffer) {
            return res.status(400).json({ message: "Invalid PDF upload" });
        }

        const uploadedSubmission = await uploadPdfBuffer(
            uploadBuffer,
            "sa7a7ly/submissions",
            studentUploadFormat
        );
        const pdfPath = uploadedSubmission.secure_url;

        const submission = await Submission.create({
            assignmentId,
            studentId: studentId || null,
            studentName: normalizedStudentName,
            pdfPath,
            submittedBy: staff._id,
            submittedByRole: staff.role,
            status: "QUEUED",
        });
        console.log(
            `[SubmissionFlow] saved (on-behalf): submissionId=${submission._id} assignmentId=${assignmentId}`
        );

        if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
            latestRequest.used = true;
            latestRequest.usedAt = new Date();
            await latestRequest.save();
        }

        let queuedJob;
        try {
            queuedJob = await gradingQueue.addGradingJob({
                submissionId: submission._id.toString(),
                teacherId: classroom.teacherId?.toString() || null,
            });
        } catch (queueErr) {
            await Submission.findByIdAndUpdate(submission._id, {
                $set: {
                    status: "FAILED_PERMANENT",
                    feedback: `Queueing failed: ${queueErr.message || "Unknown queue error"}`,
                },
            }).catch(() => null);
            throw queueErr;
        }
        console.log(
            `[SubmissionFlow] queued (on-behalf): submissionId=${submission._id} jobId=${queuedJob?.id || "n/a"}`
        );
        console.log(`[SubmissionFlow] response sent (on-behalf): submissionId=${submission._id}`);

        return res.status(201).json({
            submission,
            alreadySubmitted: false,
            resubmissionRequest: latestRequest || null,
        });
    } catch (err) {
        console.error("SUBMISSION ERROR:", err);
        res.status(500).json({ message: err.message });
    }
};

// GET submissions
exports.getSubmissions = async(req, res) => {
    const query = {};
    const requesterRole = req.user?.role;
    const requesterId = req.user?.userId;

    if (requesterRole === "STUDENT" && requesterId) {
        query.studentId = requesterId;
    }
    if (req.query.assignmentId) {
        query.assignmentId = req.query.assignmentId;
    }
    if (req.query.studentId && requesterRole !== "STUDENT") {
        query.studentId = req.query.studentId;
    }
    if (req.query.classroomId) {
        const assignments = await Assignment.find({ classroomId: req.query.classroomId }).select("_id");
        query.assignmentId = { $in: assignments.map((a) => a._id) };
    }

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;
    const total = await Submission.countDocuments(query);

    const submissions = await Submission.find(query)
        .populate("studentId", "name email")
        .populate("assignmentId", "title totalPoints dueDate resultVisibility")
        .skip(skip)
        .limit(limit);

    const submissionsWithVisibility = submissions.map((submission) => {
        const assignment = submission?.assignmentId || null;
        const payload = buildSubmissionResponse(submission, assignment, requesterRole);
        return {
            ...payload.submission,
            resultVisible: payload.resultVisible,
            visibilityPolicy: payload.visibilityPolicy,
        };
    });
    res.set("X-Total-Count", total.toString());
    res.set("X-Page", page.toString());
    res.set("X-Limit", limit.toString());
    res.json(submissionsWithVisibility);
};

// GET single submission
exports.getSubmission = async(req, res) => {
    const submission = await Submission.findById(req.params.id)
        .populate("studentId", "name email")
        .populate("assignmentId", "title totalPoints dueDate resultVisibility");

    if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
    }

    const payload = buildSubmissionResponse(submission, submission.assignmentId, req.user?.role);
    res.json({
        ...payload.submission,
        resultVisible: payload.resultVisible,
        visibilityPolicy: payload.visibilityPolicy,
    });
};

// GET latest submission for a student + assignment
exports.getStudentSubmission = async(req, res) => {
    try {
        const { assignmentId } = req.query;
        const studentId = req.user?.userId;
        if (!assignmentId || !studentId) {
            return res.status(400).json({ message: "Assignment and student are required" });
        }

        const submission = await Submission.findOne({ assignmentId, studentId })
            .sort({ submittedAt: -1 })
            .populate("assignmentId", "title totalPoints dueDate resultVisibility");

        const resubmissionRequest = await ResubmissionRequest.findOne({
            assignmentId,
            studentId,
        }).sort({ createdAt: -1 });

        const payload = buildSubmissionResponse(
            submission,
            submission ? submission.assignmentId : null,
            req.user?.role
        );

        res.json({
            submission: payload.submission,
            resultVisible: payload.resultVisible,
            visibilityPolicy: payload.visibilityPolicy,
            resubmissionRequest: resubmissionRequest || null,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST mark reviewed in bulk (teacher/assistant/admin)
exports.markSubmissionsReviewed = async(req, res) => {
    try {
        const { classroomId, assignmentId } = req.body || {};
        if (!classroomId && !assignmentId) {
            return res.status(400).json({ message: "classroomId or assignmentId is required" });
        }

        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const now = new Date();
        const query = {};

        if (assignmentId) {
            const assignment = await Assignment.findById(assignmentId).select("classroomId");
            if (!assignment) {
                return res.status(404).json({ message: "Assignment not found" });
            }
            try {
                await ensureStaffCanManageClassroom(userId, userRole, assignment.classroomId);
            } catch (err) {
                if (err.message === "FORBIDDEN_CLASSROOM") {
                    return res.status(403).json({ message: "Not allowed to review this assignment" });
                }
                throw err;
            }
            query.assignmentId = assignmentId;
        } else {
            const classroom = await Classroom.findById(classroomId).select("_id");
            if (!classroom) {
                return res.status(404).json({ message: "Classroom not found" });
            }
            try {
                await ensureStaffCanManageClassroom(userId, userRole, classroomId);
            } catch (err) {
                if (err.message === "FORBIDDEN_CLASSROOM") {
                    return res.status(403).json({ message: "Not allowed to review this classroom" });
                }
                throw err;
            }
            const assignments = await Assignment.find({ classroomId }).select("_id");
            query.assignmentId = { $in: assignments.map((a) => a._id) };
        }

        const updateResult = await Submission.updateMany(query, {
            $set: {
                reviewedByStaffAt: now,
                reviewedByStaffId: userId || null,
            },
        });

        return res.json({
            message: "Submissions marked as reviewed",
            matchedCount: updateResult.matchedCount || 0,
            modifiedCount: updateResult.modifiedCount || 0,
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// PATCH submission review (teacher/assistant/admin)
exports.updateSubmissionReview = async(req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const assignment = await Assignment.findById(submission.assignmentId).select(
            "classroomId totalPoints dueDate resultVisibility title"
        );
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        const allowed = await canManageSubmissionForClassroom(
            req.user?.userId,
            req.user?.role,
            assignment.classroomId
        );
        if (!allowed) {
            return res.status(403).json({ message: "Not allowed to edit this submission" });
        }

        const hasFeedback = Object.prototype.hasOwnProperty.call(req.body, "feedback");
        const hasGrade = Object.prototype.hasOwnProperty.call(req.body, "grade");
        const markReviewed = req.body.markReviewed === true || req.body.markReviewed === "true";
        if (!hasFeedback && !hasGrade && !markReviewed) {
            return res.status(400).json({ message: "Nothing to update" });
        }

        if (hasFeedback) {
            submission.feedback = String(req.body.feedback || "").trim();
        }

        if (hasGrade) {
            const parsedGrade = Number(req.body.grade);
            if (!Number.isFinite(parsedGrade)) {
                return res.status(400).json({ message: "Grade must be a valid number" });
            }
            if (parsedGrade < 0 || parsedGrade > assignment.totalPoints) {
                return res.status(400).json({
                    message: `Grade must be between 0 and ${assignment.totalPoints}`,
                });
            }
            submission.grade = parsedGrade;
        }

        if (hasFeedback || hasGrade || markReviewed) {
            submission.reviewedByStaffAt = new Date();
            submission.reviewedByStaffId = req.user?.userId || null;
        }
        submission.gradedAt = new Date();
        await submission.save();

        const updated = await Submission.findById(submission._id)
            .populate("studentId", "name email")
            .populate("assignmentId", "title totalPoints dueDate resultVisibility");

        const payload = buildSubmissionResponse(updated, assignment, req.user?.role);

        return res.json({
            ...payload.submission,
            resultVisible: payload.resultVisible,
            visibilityPolicy: payload.visibilityPolicy,
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// DELETE submission (teacher/assistant/admin)
exports.deleteSubmission = async(req, res) => {
    try {
        const submission = await Submission.findById(req.params.id).select(
            "assignmentId"
        );
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const assignment = await Assignment.findById(submission.assignmentId).select(
            "classroomId"
        );
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        const allowed = await canManageSubmissionForClassroom(
            req.user?.userId,
            req.user?.role,
            assignment.classroomId
        );
        if (!allowed) {
            return res.status(403).json({ message: "Not allowed to delete this submission" });
        }

        await Submission.findByIdAndDelete(req.params.id);
        return res.json({ message: "Submission deleted" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET submission PDF (authenticated proxy)
exports.getSubmissionPdf = async(req, res) => {
    try {
        const submission = await Submission.findById(req.params.id).select(
            "assignmentId studentId pdfPath"
        );
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const assignment = await Assignment.findById(submission.assignmentId).select(
            "classroomId dueDate resultVisibility"
        );
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        const userRole = req.user?.role;
        const userId = req.user?.userId;

        let allowed = false;
        if (userRole === "ADMIN") {
            allowed = true;
        } else if (userRole === "TEACHER" || userRole === "ASSISTANT") {
            allowed = await canManageSubmissionForClassroom(userId, userRole, assignment.classroomId);
        } else if (userRole === "STUDENT") {
            allowed =
                submission.studentId &&
                submission.studentId.toString() === userId?.toString();
        }

        if (!allowed) {
            return res.status(403).json({ message: "Not allowed to view this PDF" });
        }

        const pdfBuffer = await getPdfBuffer(submission.pdfPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="submission-${submission._id}.pdf"`);
        return res.send(pdfBuffer);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
