const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const ResubmissionRequest = require("../models/ResubmissionRequest");
const Classroom = require("../models/Classroom");
const User = require("../models/User");
const { uploadPdfBuffer, cloudinary } = require("../services/cloudinary");


const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" +
    process.env.GEMINI_API_KEY;

// Helper: Call Gemini with retry
async function callGemini(payload, retries = 2) {
    try {
        const response = await axios.post(GEMINI_URL, payload, {
            timeout: 180000,
        });

        if (
            response &&
            response.data &&
            response.data.candidates &&
            response.data.candidates.length > 0 &&
            response.data.candidates[0].content &&
            response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0
        ) {
            return response.data.candidates[0].content.parts[0].text;
        }

        throw new Error("Empty Gemini response");
    } catch (err) {
        if (retries > 0) {
            return await callGemini(payload, retries - 1);
        }
        throw err;
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
        try {
            const response = await axios.get(source, { responseType: "arraybuffer" });
            return Buffer.from(response.data);
        } catch (err) {
            const status = err?.response?.status;
            const cloudinaryAsset =
                status &&
                [401, 403].includes(status) &&
                source.includes("res.cloudinary.com")
                    ? parseCloudinaryAsset(source)
                    : null;

            if (cloudinaryAsset) {
                let lastError = err;
                const candidates = getPublicIdCandidates(cloudinaryAsset.publicId);

                for (const candidate of candidates) {
                    try {
                        const signedUrl = cloudinary.utils.private_download_url(
                            candidate,
                            "pdf",
                            {
                                resource_type: "raw",
                                type: cloudinaryAsset.type,
                                expires_at: Math.floor(Date.now() / 1000) + 300,
                            }
                        );
                        const signedResponse = await axios.get(signedUrl, {
                            responseType: "arraybuffer",
                        });
                        return Buffer.from(signedResponse.data);
                    } catch (candidateErr) {
                        lastError = candidateErr;
                    }
                }

                throw lastError;
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
            return res.status(200).json({
                submission: existingSubmission,
                alreadySubmitted: true,
                resubmissionRequest: latestRequest || null,
            });
        }

        const studentPdf = req.file.buffer;
        const modelPdf = await getPdfBuffer(assignment.modelAnswerPdfPath);

        // 🔒 Identical file check
        const studentHash = crypto
            .createHash("sha256")
            .update(studentPdf)
            .digest("hex");
        const modelHash = crypto
            .createHash("sha256")
            .update(modelPdf)
            .digest("hex");

        if (studentHash === modelHash) {
            const uploadedSubmission = await uploadPdfBuffer(
                req.file.buffer,
                "sa7a7ly/submissions"
            );
            const submission = await Submission.create({
                assignmentId,
                studentId,
                pdfPath: uploadedSubmission.secure_url,
                grade: assignment.totalPoints,
                feedback: "Identical to model answer. Full marks awarded.",
                submittedBy: studentId,
                submittedByRole: "STUDENT",
                gradedAt: new Date(),
            });

            if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
                latestRequest.used = true;
                latestRequest.usedAt = new Date();
                await latestRequest.save();
            }

            return res.status(201).json({
                submission,
                alreadySubmitted: false,
                resubmissionRequest: latestRequest || null,
            });
        }

        const prompt = `
You are a strict university professor.

Compare the STUDENT PDF and MODEL ANSWER PDF.

GRADING RULES:

Extract all questions from MODEL ANSWER.

Grade EACH question separately.

Deduct marks for:

Missing important steps

Missing key formulas

Missing core explanations

Logical mistakes

Weak justification

Incomplete answers

Minor wording differences or small presentation issues should NOT automatically lose marks if the meaning is clear.

If a required concept or step is completely absent, it is WRONG.

Do NOT assume intention.

Do NOT mix questions.

Be strict, but allow partial credit for partially correct reasoning.

DOUBLE CHECK BEFORE RETURNING:

Sum of studentMarks must equal totalGrade.

studentMarks <= maxMarks.

marksLost = maxMarks - studentMarks.

No invented mistakes.

Return ONLY valid JSON:

{
"totalGrade": number,
"questions": [
{
"questionNumber": "Q1",
"maxMarks": number,
"studentMarks": number,
"marksLost": number,
"reasonForDeduction": "Clear explanation"
}
],
"overallSummary": "2-3 sentence strict evaluation",
"majorMistakes": ["mistake 1"],
"improvementAdvice": ["improvement 1"]
}

Total maximum marks = ${assignment.totalPoints}

DO NOT return markdown.
ONLY return pure JSON.
`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: studentPdf.toString("base64"),
                        },
                    },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: modelPdf.toString("base64"),
                        },
                    },
                ],
            }, ],
        };

        let aiText = await callGemini(payload);

        // Clean response
        const cleaned = aiText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let result;
        try {
            result = JSON.parse(cleaned);
        } catch (err) {
            throw new Error("AI returned invalid JSON");
        }

        // 🧠 Backend Safety Check
        let calculatedTotal = 0;

        if (result.questions && result.questions.length > 0) {
            result.questions.forEach((q) => {
                if (q.studentMarks > q.maxMarks) {
                    q.studentMarks = q.maxMarks;
                }

                q.marksLost = q.maxMarks - q.studentMarks;
                calculatedTotal += q.studentMarks;
            });
        }

        if (calculatedTotal !== result.totalGrade) {
            result.totalGrade = calculatedTotal;
        }

        if (result.totalGrade > assignment.totalPoints) {
            result.totalGrade = assignment.totalPoints;
        }

        // 📝 Build feedback
        let feedbackText = "Question Breakdown:\n\n";

        if (result.questions && result.questions.length > 0) {
            result.questions.forEach((q) => {
                feedbackText += `${q.questionNumber}\n`;
                feedbackText += `Max Marks: ${q.maxMarks}\n`;
                feedbackText += `Your Marks: ${q.studentMarks}\n`;
                feedbackText += `Marks Lost: ${q.marksLost}\n`;
                feedbackText += `Reason: ${q.reasonForDeduction}\n\n`;
            });
        }

        feedbackText += "Overall Summary:\n" + result.overallSummary + "\n\n";

        if (result.majorMistakes && result.majorMistakes.length > 0) {
            feedbackText += "Major Mistakes:\n";
            result.majorMistakes.forEach((m) => {
                feedbackText += "- " + m + "\n";
            });
        }

        if (
            result.improvementAdvice &&
            result.improvementAdvice.length > 0
        ) {
            feedbackText += "\nHow To Improve:\n";
            result.improvementAdvice.forEach((i) => {
                feedbackText += "- " + i + "\n";
            });
        }

        const uploadedSubmission = await uploadPdfBuffer(
            req.file.buffer,
            "sa7a7ly/submissions"
        );

        const submission = await Submission.create({
            assignmentId,
            studentId,
            pdfPath: uploadedSubmission.secure_url,
            grade: result.totalGrade,
            feedback: feedbackText.trim(),
            submittedBy: studentId,
            submittedByRole: "STUDENT",
            gradedAt: new Date(),
        });
        if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
            latestRequest.used = true;
            latestRequest.usedAt = new Date();
            await latestRequest.save();
        }

        res.status(201).json({
            submission,
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

        res.status(500).json({
            message: err &&
                err.response &&
                err.response.data &&
                err.response.data.error ?
                err.response.data.error.message : err.message,
        });
    }
};

// Submit on behalf (teacher/assistant)
exports.submitAssignmentOnBehalf = async (req, res) => {
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

        const existingSubmission = studentId
            ? await Submission.findOne({ assignmentId, studentId }).sort({ submittedAt: -1 })
            : null;

        const latestRequest = studentId
            ? await ResubmissionRequest.findOne({ assignmentId, studentId }).sort({ createdAt: -1 })
            : null;

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

        const studentPdf = fs.readFileSync(req.file.path);
        const modelPdf = fs.readFileSync(assignment.modelAnswerPdfPath);

        const studentHash = crypto
            .createHash("sha256")
            .update(studentPdf)
            .digest("hex");
        const modelHash = crypto
            .createHash("sha256")
            .update(modelPdf)
            .digest("hex");

        if (studentHash === modelHash) {
            const submission = await Submission.create({
                assignmentId,
                studentId: studentId || null,
                studentName: normalizedStudentName,
                pdfPath: req.file.path,
                grade: assignment.totalPoints,
                feedback: "Identical to model answer. Full marks awarded.",
                submittedBy: staff._id,
                submittedByRole: staff.role,
                gradedAt: new Date(),
            });

            if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
                latestRequest.used = true;
                latestRequest.usedAt = new Date();
                await latestRequest.save();
            }

            return res.status(201).json({
                submission,
                alreadySubmitted: false,
                resubmissionRequest: latestRequest || null,
            });
        }

        const prompt = `
You are an experienced IGCSE examiner.

Your task is to grade the STUDENT PDF against the MODEL ANSWER PDF exactly like a real IGCSE marker.

Your grading MUST follow authentic IGCSE principles.

CORE IGCSE MARKING RULES:

1. Use the MODEL ANSWER as the official mark scheme.
2. Identify ALL questions and sub-questions from the MODEL ANSWER.
3. For EACH question, determine:
   - Method marks (M)
   - Accuracy marks (A)
   - Explanation/working marks (E) if applicable.

4. Award marks using POSITIVE MARKING:
   - Give credit for correct method even if final answer is wrong.
   - Give partial credit when working shows correct logic.
   - Do NOT require exact wording if mathematical/scientific meaning is clear.

5. Apply ERROR CARRY FORWARD (ECF):
   - If an early mistake is made, but later steps correctly follow that mistake, award subsequent method marks.

6. Penalize ONLY when:
   - Required steps are missing
   - Formula is incorrect
   - Logic is wrong
   - Final answer contradicts working
   - Key explanation is absent

7. Do NOT double-penalize:
   - One mistake should not remove multiple marks unless explicitly required.

8. Be HUMAN-LIKE:
   - Accept equivalent methods.
   - Accept alternative correct approaches.
   - Accept rounded answers within reasonable tolerance.
   - Give benefit of doubt when intent is clear.

9. If something is completely missing -> ZERO for that part.

10. NEVER invent mistakes.
11. NEVER assume knowledge not shown.
12. NEVER mix answers between questions.

MARK CONSISTENCY CHECK (MANDATORY):

- studentMarks <= maxMarks
- marksLost = maxMarks - studentMarks
- Sum of all studentMarks MUST equal totalGrade
- totalGrade MUST NOT exceed total maximum marks

OUTPUT FORMAT:

Return ONLY valid JSON. No markdown. No commentary.

{
  "totalGrade": number,
  "questions": [
    {
      "questionNumber": "Q1(a)",
      "maxMarks": number,
      "studentMarks": number,
      "marksLost": number,
      "reasonForDeduction": "Clear IGCSE-style explanation"
    }
  ],
  "overallSummary": "Short examiner-style evaluation (2-3 sentences)",
  "majorMistakes": ["mistake 1"],
  "improvementAdvice": ["improvement 1"]
}

Total maximum marks = ${assignment.totalPoints}

IMPORTANT:
Grade like a real IGCSE examiner - balanced, method-aware, and fair.
Do NOT be overly harsh.
Do NOT be overly generous.
Behave exactly like a trained human marker.
Return ONLY pure JSON.
`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: studentPdf.toString("base64"),
                        },
                    },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: modelPdf.toString("base64"),
                        },
                    },
                ],
            }, ],
        };

        let aiText = await callGemini(payload);
        const cleaned = aiText.replace(/```json/gi, "").replace(/```/g, "").trim();

        let result;
        try {
            result = JSON.parse(cleaned);
        } catch (err) {
            throw new Error("AI returned invalid JSON");
        }

        let calculatedTotal = 0;
        if (result.questions && result.questions.length > 0) {
            result.questions.forEach((q) => {
                if (q.studentMarks > q.maxMarks) {
                    q.studentMarks = q.maxMarks;
                }
                q.marksLost = q.maxMarks - q.studentMarks;
                calculatedTotal += q.studentMarks;
            });
        }

        if (calculatedTotal !== result.totalGrade) {
            result.totalGrade = calculatedTotal;
        }

        if (result.totalGrade > assignment.totalPoints) {
            result.totalGrade = assignment.totalPoints;
        }

        let feedbackText = "Question Breakdown:\n\n";
        if (result.questions && result.questions.length > 0) {
            result.questions.forEach((q) => {
                feedbackText += `${q.questionNumber}\n`;
                feedbackText += `Max Marks: ${q.maxMarks}\n`;
                feedbackText += `Your Marks: ${q.studentMarks}\n`;
                feedbackText += `Marks Lost: ${q.marksLost}\n`;
                feedbackText += `Reason: ${q.reasonForDeduction}\n\n`;
            });
        }

        feedbackText += "Overall Summary:\n" + result.overallSummary + "\n\n";

        if (result.majorMistakes && result.majorMistakes.length > 0) {
            feedbackText += "Major Mistakes:\n";
            result.majorMistakes.forEach((m) => {
                feedbackText += "- " + m + "\n";
            });
        }

        if (result.improvementAdvice && result.improvementAdvice.length > 0) {
            feedbackText += "\nHow To Improve:\n";
            result.improvementAdvice.forEach((i) => {
                feedbackText += "- " + i + "\n";
            });
        }

        const submission = await Submission.create({
            assignmentId,
            studentId: studentId || null,
            studentName: normalizedStudentName,
            pdfPath: req.file.path,
            grade: result.totalGrade,
            feedback: feedbackText.trim(),
            submittedBy: staff._id,
            submittedByRole: staff.role,
            gradedAt: new Date(),
        });

        if (latestRequest && latestRequest.status === "APPROVED" && !latestRequest.used) {
            latestRequest.used = true;
            latestRequest.usedAt = new Date();
            await latestRequest.save();
        }

        res.status(201).json({
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
    if (req.query.assignmentId) {
        query.assignmentId = req.query.assignmentId;
    }
    if (req.query.studentId) {
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
        .populate("assignmentId", "title totalPoints dueDate")
        .skip(skip)
        .limit(limit);
    res.set("X-Total-Count", total.toString());
    res.set("X-Page", page.toString());
    res.set("X-Limit", limit.toString());
    res.json(submissions);
};

// GET single submission
exports.getSubmission = async(req, res) => {
    const submission = await Submission.findById(req.params.id)
        .populate("studentId", "name email")
        .populate("assignmentId", "title totalPoints");

    if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
};

// GET latest submission for a student + assignment
exports.getStudentSubmission = async (req, res) => {
    try {
        const { assignmentId } = req.query;
        const studentId = req.user?.userId;
        if (!assignmentId || !studentId) {
            return res.status(400).json({ message: "Assignment and student are required" });
        }

        const submission = await Submission.findOne({ assignmentId, studentId })
            .sort({ submittedAt: -1 })
            .populate("assignmentId", "title totalPoints dueDate");

        const resubmissionRequest = await ResubmissionRequest.findOne({
            assignmentId,
            studentId,
        }).sort({ createdAt: -1 });

        res.json({ submission: submission || null, resubmissionRequest: resubmissionRequest || null });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
