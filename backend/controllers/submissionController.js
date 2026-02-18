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
    topP: 0.01,
    responseMimeType: "application/json",
};

function buildDeterministicPayload(parts) {
    return {
        contents: [{ parts }],
        generationConfig: DETERMINISTIC_GENERATION_CONFIG,
    };
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

async function detectPdfLanguage(studentPdf) {
    const prompt = `
Detect the primary language of the STUDENT PDF.
Return ONLY valid JSON:
{
"detectedLanguage": "arabic or english"
}
DO NOT return markdown.
ONLY return pure JSON.
`;

    const payload = buildDeterministicPayload([
        { text: prompt },
        {
            inlineData: {
                mimeType: "application/pdf",
                data: studentPdf.toString("base64"),
            },
        },
    ]);

    try {
        const aiText = await callGemini(payload);
        const cleaned = aiText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const result = JSON.parse(cleaned);
        return String(result?.detectedLanguage || "").toLowerCase().includes("arabic");
    } catch {
        return false;
    }
}

function isArabicResult(result) {
    const languageText = String(result?.detectedLanguage || "").toLowerCase();
    return languageText.includes("arabic") || languageText === "ar";
}

function countArabicChars(input) {
    return (String(input || "").match(/[\u0600-\u06FF]/g) || []).length;
}

function recoverArabicMojibake(input) {
    const src = String(input || "");
    if (!src) return src;
    if (countArabicChars(src) >= 2) return src;
    if (!/[þØÙÃÂ]/.test(src)) return src;

    const candidates = [
        Buffer.from(src, "latin1").toString("utf8"),
        Buffer.from(src, "latin1").toString("utf16le"),
    ];

    let best = src;
    let bestScore = countArabicChars(src);

    candidates.forEach((candidate) => {
        const score = countArabicChars(candidate);
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    });

    return bestScore >= 2 ? best : src;
}

function normalizeResultTextFields(result) {
    if (!result || typeof result !== "object") return result;

    if (Array.isArray(result.questions)) {
        result.questions = result.questions.map((q) => ({
            ...q,
            reasonForDeduction: recoverArabicMojibake(q?.reasonForDeduction),
        }));
    }

    result.overallSummary = recoverArabicMojibake(result.overallSummary);

    if (Array.isArray(result.majorMistakes)) {
        result.majorMistakes = result.majorMistakes.map((m) => recoverArabicMojibake(m));
    }

    if (Array.isArray(result.improvementAdvice)) {
        result.improvementAdvice = result.improvementAdvice.map((a) => recoverArabicMojibake(a));
    }

    return result;
}

function buildDetailedFeedbackText(result, isArabic) {
    let feedbackText = isArabic ?
        "تفصيل الدرجات:\n\n" :
        "Question Breakdown:\n\n";

    if (result.questions && result.questions.length > 0) {
        result.questions.forEach((q) => {
            const full = Number(q.studentMarks) === Number(q.maxMarks);
            const partial = Number(q.studentMarks) > 0 && Number(q.studentMarks) < Number(q.maxMarks);
            const status = full ?
                (isArabic ? "ممتاز" : "Excellent") :
                partial ?
                (isArabic ? "جيد مع نقص" : "Good but incomplete") :
                (isArabic ? "يحتاج تحسين" : "Needs improvement");

            feedbackText += `${q.questionNumber} - ${status}\n`;
            feedbackText += isArabic ?
                `الدرجة الكلية: ${q.maxMarks}\n` :
                `Max Marks: ${q.maxMarks}\n`;
            feedbackText += isArabic ?
                `درجتك: ${q.studentMarks}\n` :
                `Your Marks: ${q.studentMarks}\n`;
            feedbackText += isArabic ?
                `الدرجات المفقودة: ${q.marksLost}\n` :
                `Marks Lost: ${q.marksLost}\n`;
            feedbackText += isArabic ?
                `سبب الخصم: ${q.reasonForDeduction || "لا يوجد سبب واضح."}\n\n` :
                `Reason: ${q.reasonForDeduction || "No clear reason provided."}\n\n`;
        });
    } else {
        feedbackText += isArabic ?
            "لا يوجد تفصيل للأسئلة.\n\n" :
            "No question-level details were provided.\n\n";
    }

    feedbackText += isArabic ?
        "التقييم العام:\n" + (result.overallSummary || "لا يوجد ملخص متاح.") + "\n\n" :
        "Overall Summary:\n" + (result.overallSummary || "No summary provided.") + "\n\n";

    feedbackText += isArabic ? "أهم الأخطاء:\n" : "Major Mistakes:\n";
    if (result.majorMistakes && result.majorMistakes.length > 0) {
        result.majorMistakes.forEach((m, idx) => {
            feedbackText += `${idx + 1}. ${m}\n`;
        });
    } else {
        feedbackText += isArabic ? "1. لا توجد أخطاء كبيرة ظاهرة.\n" : "1. No major mistakes listed.\n";
    }

    feedbackText += isArabic ? "\nكيفية التحسين:\n" : "\nHow To Improve:\n";
    if (result.improvementAdvice && result.improvementAdvice.length > 0) {
        result.improvementAdvice.forEach((i, idx) => {
            feedbackText += `${idx + 1}. ${i}\n`;
        });
    } else {
        feedbackText += isArabic ? "1. راجع الحل خطوة بخطوة.\n" : "1. Review each solution step-by-step.\n";
    }

    return feedbackText.trim();
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
            const isArabic = await detectPdfLanguage(studentPdf);
            const uploadedSubmission = await uploadPdfBuffer(
                req.file.buffer,
                "sa7a7ly/submissions"
            );
            const submission = await Submission.create({
                assignmentId,
                studentId,
                pdfPath: uploadedSubmission.secure_url,
                grade: assignment.totalPoints,
                feedback: isArabic ?
                    "الإجابة مطابقة لنموذج الحل. تم منح الدرجة كاملة." :
                    "Identical to model answer. Full marks awarded.",
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

First, detect the primary language of the assignment (Arabic or English).
If the assignment content is mostly Arabic, ALL feedback must be written in Arabic.
If the assignment content is mostly English, ALL feedback must be written in English.

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

Use one fixed standard for all students in this assignment.
Do not change strictness between submissions.
Do not change question max marks between students.

FEEDBACK STYLE RULES:

Use simple, student-friendly language.
Avoid jargon and long sentences.

For each question "reasonForDeduction", include:
1) what was done correctly (if any),
2) what is missing/wrong,
3) one concrete next step.

Keep each reason concise but specific (about 1-3 short sentences).

Make "overallSummary" 3-5 short, clear sentences.

Return at least 3 items in "majorMistakes" and at least 3 items in "improvementAdvice"
when enough evidence exists in the submission.

DOUBLE CHECK BEFORE RETURNING:

Sum of studentMarks must equal totalGrade.
studentMarks <= maxMarks.
marksLost = maxMarks - studentMarks.
No invented mistakes.

Return ONLY valid JSON:

{
"detectedLanguage": "arabic or english",
"totalGrade": number,
"questions": [
{
"questionNumber": "Q1",
"maxMarks": number,
"studentMarks": number,
"marksLost": number,
"reasonForDeduction": "Clear explanation written in same detected language"
}
],
"overallSummary": "2-3 sentence strict evaluation in same detected language",
"majorMistakes": ["mistake 1 in same detected language"],
"improvementAdvice": ["improvement 1 in same detected language"]
}

Total maximum marks = ${assignment.totalPoints}

DO NOT return markdown.
ONLY return pure JSON.
`;


        const payload = buildDeterministicPayload([
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
        normalizeResultTextFields(result);
        const isArabic = isArabicResult(result);


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

        const feedbackText = buildDetailedFeedbackText(result, isArabic);

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

        const studentPdf = req.file.buffer;
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
            const isArabic = await detectPdfLanguage(studentPdf);
            const uploadedSubmission = await uploadPdfBuffer(
                req.file.buffer,
                "sa7a7ly/submissions"
            );
            const submission = await Submission.create({
                assignmentId,
                studentId: studentId || null,
                studentName: normalizedStudentName,
                pdfPath: uploadedSubmission.secure_url,
                grade: assignment.totalPoints,
                feedback: isArabic ?
                    "الإجابة مطابقة لنموذج الحل. تم منح الدرجة كاملة." : "Identical to model answer. Full marks awarded.",
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

First, detect the primary language of the assignment (Arabic or English).
If the assignment content is mostly Arabic, ALL feedback must be written in Arabic.
If the assignment content is mostly English, ALL feedback must be written in English.

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

Use one fixed standard for all students in this assignment.

Do not change strictness between submissions.

Do not change question max marks between students.

FEEDBACK STYLE RULES:

Use simple, student-friendly language.
Avoid jargon and long sentences.

For each question "reasonForDeduction", include:
1) what was done correctly (if any),
2) what is missing/wrong,
3) one concrete next step.

Keep each reason concise but specific (about 1-3 short sentences).

Make "overallSummary" 3-5 short, clear sentences.

Return at least 3 items in "majorMistakes" and at least 3 items in "improvementAdvice"
when enough evidence exists in the submission.

DOUBLE CHECK BEFORE RETURNING:

Sum of studentMarks must equal totalGrade.

studentMarks <= maxMarks.

marksLost = maxMarks - studentMarks.

No invented mistakes.

Return ONLY valid JSON:

{
"detectedLanguage": "arabic or english",
"totalGrade": number,
"questions": [
{
"questionNumber": "Q1",
"maxMarks": number,
"studentMarks": number,
"marksLost": number,
"reasonForDeduction": "Clear explanation written in same detected language"
}
],
"overallSummary": "2-3 sentence strict evaluation in same detected language",
"majorMistakes": ["mistake 1 in same detected language"],
"improvementAdvice": ["improvement 1 in same detected language"]
}

Total maximum marks = ${assignment.totalPoints}

DO NOT return markdown.
ONLY return pure JSON.
`;

        const payload = buildDeterministicPayload([
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
        ]);

        let aiText = await callGemini(payload);
        const cleaned = aiText.replace(/```json/gi, "").replace(/```/g, "").trim();

        let result;
        try {
            result = JSON.parse(cleaned);
        } catch (err) {
            throw new Error("AI returned invalid JSON");
        }
        normalizeResultTextFields(result);
        const isArabic = isArabicResult(result);

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

        const feedbackText = buildDetailedFeedbackText(result, isArabic);

        const uploadedSubmission = await uploadPdfBuffer(
            req.file.buffer,
            "sa7a7ly/submissions"
        );
        const submission = await Submission.create({
            assignmentId,
            studentId: studentId || null,
            studentName: normalizedStudentName,
            pdfPath: uploadedSubmission.secure_url,
            grade: result.totalGrade,
            feedback: feedbackText,
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
