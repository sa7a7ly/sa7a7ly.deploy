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
const DETERMINISTIC_GENERATION_CONFIG = {
    temperature: 0,
    topK: 1,
    topP: 0,
    candidateCount: 1,
    seed: 42,
    responseMimeType: "application/json",
};
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

function buildDeterministicPayload(parts) {
    return {
        contents: [{ parts }],
        generationConfig: DETERMINISTIC_GENERATION_CONFIG,
    };
}

function resolveQuestionReason(question) {
    const candidate = question?.feedback ?? question?.reasonForDeduction;
    if (typeof candidate !== "string") {
        return "No reason provided";
    }
    const normalized = candidate.trim();
    if (!normalized) {
        return "No reason provided";
    }
    const lower = normalized.toLowerCase();
    if (lower === "undefined" || lower === "null" || lower === "n/a") {
        return "No reason provided";
    }
    return normalized;
}

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
                status && [401, 403].includes(status) &&
                source.includes("res.cloudinary.com") ?
                parseCloudinaryAsset(source) :
                null;

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
            return res.status(200).json({
                submission: existingSubmission,
                alreadySubmitted: true,
                resubmissionRequest: latestRequest || null,
            });
        }

        const studentPdf = req.file.buffer;
        const studentMimeType = getStudentMimeType(req.file);
        const studentUploadFormat = getStudentUploadFormat(req.file);
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
                "sa7a7ly/submissions",
                studentUploadFormat
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
You are a strict academic examiner.

Compare the STUDENT PDF with the MODEL ANSWER PDF.

The MODEL ANSWER is the ONLY source of truth.

You MUST infer from the MODEL ANSWER:

- Expected structure
- Required content
- Required language level
- Mark distribution
- Writing style expectations
- Any mandatory elements

Do NOT assume any fixed format.
Do NOT assume this is a personal letter.
Do NOT assume Arabic rhetoric unless the MODEL shows it.
Do NOT assume specific sections unless they appear in the MODEL.

------------------------------------------------------------
PRESENTATION RULE
------------------------------------------------------------

Ignore handwriting quality, page cleanliness, crossings-out, spacing, or formatting.
Grade ONLY written content.

------------------------------------------------------------
LANGUAGE DETECTION
------------------------------------------------------------

Detect whether the student's writing is mostly Arabic or English.
All feedback must be written in that language.

------------------------------------------------------------
GRADING RULES
------------------------------------------------------------

Total marks = ${assignment.totalPoints}.

Split marks into:

- Content
- Language

You MUST determine the correct weighting based on the MODEL ANSWER.

------------------------------------------------------------
EVALUATION PROCESS (MANDATORY)
------------------------------------------------------------

1. Extract required ideas and structure from MODEL ANSWER.
2. Compare student work against them.
3. Identify missing, incorrect, or weak content.
4. Identify spelling, grammar, and language quality issues.
5. Deduct marks logically based on importance.

Do NOT invent requirements not present in MODEL.

------------------------------------------------------------
OUTPUT FORMAT INSIDE reasonForDeduction 
------------------------------------------------------------

Inside "reasonForDeduction", output ONLY:

التقييم بالمضمون:
- اذكر أخطاء المضمون أو النقص مقارنة بالنموذج.
- اذكر الدرجة النهائية للمضمون.

التقييم اللغوي:
- اذكر الأخطاء الإملائية (خطأ ← تصحيح).
- اذكر الأخطاء النحوية أو الأسلوبية إن وُجدت.
- اذكر الدرجة النهائية للغة.

عدد الكلمات:
- اذكر التقدير التقريبي لعدد كلمات الطالب.
- اذكر العدد المطلوب حسب النموذج إن وُجد.
- هل استوفى الشرط أم لا (نعم / لا).

STRICT:

- Do NOT add any other sections.
- Do NOT teach.
- Do NOT add examples.
- Do NOT invent mistakes.
- Do NOT add general summaries.
- You Must wrte the feedback as if you are teacher , talk directly to the student and dont mention the model

------------------------------------------------------------
RETURN ONLY VALID JSON
------------------------------------------------------------

{
  "detectedLanguage": "arabic or english",
  "totalGrade": number,
  "questions": [
    {
      "questionNumber": "Assignment",
      "maxMarks": ${assignment.totalPoints},
      "studentMarks": number,
      "marksLost": number,
      "reasonForDeduction": "As instructed above"
    }
  ]
}

Ensure:

studentMarks ≤ maxMarks  
marksLost = maxMarks − studentMarks  
totalGrade = studentMarks  

Return ONLY pure JSON.
`;

        const payload = buildDeterministicPayload([
            { text: prompt },
            {
                inlineData: {
                    mimeType: studentMimeType,
                    data: studentPdf.toString("base64"),
                },
            },
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: modelPdf.toString("base64"),
                },
            },
        ]);

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
        const isArabic = result.detectedLanguage === "arabic";


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

        let feedbackText = isArabic ?
            "تفصيل الدرجات:\n\n" :
            "Question Breakdown:\n\n";

        if (result.questions && result.questions.length > 0) {
            result.questions.forEach((q) => {
                feedbackText += `${q.questionNumber}\n`;

                feedbackText += isArabic ?
                    `الدرجة الكلية: ${q.maxMarks}\n` :
                    `Max Marks: ${q.maxMarks}\n`;

                feedbackText += isArabic ?
                    `درجتك: ${q.studentMarks}\n` :
                    `Your Marks: ${q.studentMarks}\n`;

                feedbackText += isArabic ?
                    `الدرجات المفقودة: ${q.marksLost}\n` :
                    `Marks Lost: ${q.marksLost}\n`;

                const questionReason = resolveQuestionReason(q);
                feedbackText += isArabic ?
                    `سبب الخصم: ${questionReason}\n\n` :
                    `Reason: ${questionReason}\n\n`;
            });
        }

        feedbackText += isArabic ?
            "التقييم العام:\n" + result.overallSummary + "\n\n" :
            "Overall Summary:\n" + result.overallSummary + "\n\n";

        if (result.majorMistakes && result.majorMistakes.length > 0) {
            feedbackText += isArabic ? "أهم الأخطاء:\n" : "Major Mistakes:\n";
            result.majorMistakes.forEach((m) => {
                feedbackText += "- " + m + "\n";
            });
        }

        if (result.improvementAdvice && result.improvementAdvice.length > 0) {
            feedbackText += isArabic ?
                "\nكيفية التحسين:\n" :
                "\nHow To Improve:\n";

            result.improvementAdvice.forEach((i) => {
                feedbackText += "- " + i + "\n";
            });
        }

        const uploadedSubmission = await uploadPdfBuffer(
            req.file.buffer,
            "sa7a7ly/submissions",
            studentUploadFormat
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

        const studentPdf = req.file.buffer || fs.readFileSync(req.file.path);
        const studentMimeType = getStudentMimeType(req.file);
        const studentUploadFormat = getStudentUploadFormat(req.file);
        const modelPdf = await getPdfBuffer(assignment.modelAnswerPdfPath);

        const studentHash = crypto
            .createHash("sha256")
            .update(studentPdf)
            .digest("hex");
        const modelHash = crypto
            .createHash("sha256")
            .update(modelPdf)
            .digest("hex");

        if (studentHash === modelHash) {
            let pdfPath = req.file.path || null;
            if (req.file.buffer) {
                const uploadedSubmission = await uploadPdfBuffer(
                    req.file.buffer,
                    "sa7a7ly/submissions",
                    studentUploadFormat
                );
                pdfPath = uploadedSubmission.secure_url;
            }

            const submission = await Submission.create({
                assignmentId,
                studentId: studentId || null,
                studentName: normalizedStudentName,
                pdfPath,
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
You are a strict university professor.

Compare the STUDENT PDF and MODEL ANSWER PDF.
Ignore page cleanliness, handwriting quality, crossings-out, or any visual mess; grade only the written content.

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

Use one fixed standard for all students in this assignment.

Do not change strictness between submissions.

Do not change question max marks between students.

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

        const payload = buildDeterministicPayload([
            { text: prompt },
            {
                inlineData: {
                    mimeType: studentMimeType,
                    data: studentPdf.toString("base64"),
                },
            },
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: modelPdf.toString("base64"),
                },
            },
        ]);

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
                const questionReason = resolveQuestionReason(q);
                feedbackText += `Reason: ${questionReason}\n\n`;
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

        let pdfPath = req.file.path || null;
        if (req.file.buffer) {
            const uploadedSubmission = await uploadPdfBuffer(
                req.file.buffer,
                "sa7a7ly/submissions",
                studentUploadFormat
            );
            pdfPath = uploadedSubmission.secure_url;
        }

        const submission = await Submission.create({
            assignmentId,
            studentId: studentId || null,
            studentName: normalizedStudentName,
            pdfPath,
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
exports.getStudentSubmission = async(req, res) => {
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
