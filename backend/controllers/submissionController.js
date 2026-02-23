const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const ResubmissionRequest = require("../models/ResubmissionRequest");
const Classroom = require("../models/Classroom");
const User = require("../models/User");
const { uploadPdfBuffer, cloudinary } = require("../services/cloudinary");
const {
    checkVisionOcrHealth,
    extractTextFromPdfBuffer,
} = require("../services/visionOcr");
const { cleanArabicOcrText } = require("../services/arabicOcrCleaner");

const RESULT_VISIBILITY = {
    IMMEDIATE: "IMMEDIATE",
    AFTER_DEADLINE: "AFTER_DEADLINE",
    AFTER_REVIEW: "AFTER_REVIEW",
};

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
const OCR_TEXT_MAX_CHARS = Number(process.env.OCR_TEXT_MAX_CHARS || 120000);

function trimOcrTextForPrompt(text) {
    if (typeof text !== "string") {
        return "";
    }
    if (text.length <= OCR_TEXT_MAX_CHARS) {
        return text;
    }
    return text.slice(0, OCR_TEXT_MAX_CHARS);
}
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

async function extractTextForGrading(pdfBuffer, sourceLabel) {
    try {
        const extractedText = await extractTextFromPdfBuffer(pdfBuffer, { sourceLabel });
        const cleanedText = cleanArabicOcrText(extractedText);
        const normalizedRawText =
            typeof extractedText === "string" ? extractedText.replace(/\s+/g, " ").trim() : "";
        const textForPrompt = cleanedText && cleanedText.trim() ? cleanedText : normalizedRawText;
        const trimmedText = trimOcrTextForPrompt(textForPrompt);
        if (!trimmedText.trim()) {
            throw new Error("No OCR text extracted");
        }
        return trimmedText;
    } catch (err) {
        throw new Error(`Vision OCR failed for ${sourceLabel}: ${err.message}`);
    }
}

function isOcrConfigError(errorMessage) {
    if (typeof errorMessage !== "string") {
        return false;
    }
    return (
        errorMessage.includes("GCP_OCR_BUCKET is required for Vision PDF OCR") ||
        errorMessage.includes("GCP_OCR_BUCKET is not configured")
    );
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
            const responsePayload = buildSubmissionResponse(submission, assignment, req.user?.role);

            return res.status(201).json({
                submission: responsePayload.submission,
                resultVisible: responsePayload.resultVisible,
                visibilityPolicy: responsePayload.visibilityPolicy,
                alreadySubmitted: false,
                resubmissionRequest: latestRequest || null,
            });
        }


        let studentText = "";
        let modelText = "";
        let useOcrText = true;
        try {
            studentText = await extractTextForGrading(studentPdf, "student submission");
            modelText = await extractTextForGrading(modelPdf, "model answer");
        } catch (ocrErr) {
            if (isOcrConfigError(ocrErr.message)) {
                useOcrText = false;
                console.warn(`OCR disabled for this request: ${ocrErr.message}`);
            } else {
                throw ocrErr;
            }
        }

const prompt = `
You are a strict academic examiner, but tolerant of OCR and handwriting noise.

Compare the STUDENT PDF with the MODEL ANSWER PDF.

The MODEL ANSWER is the ONLY source of truth.

------------------------------------------------------------
NOISE TOLERANCE RULE (IMPORTANT)
------------------------------------------------------------

The following issues must NOT be counted as language mistakes,
but the meaning should still be evaluated normally.

Do NOT deduct language marks for:

1) First or last letter mistakes in a word.

2) All hamza variations:
أ إ آ ؤ ئ ء

3) These Arabic letter substitutions:

ب ↔ ت ↔ ث  
ج ↔ ح ↔ خ  
د ↔ ذ  
ر ↔ ز  
س ↔ ش  
ص ↔ ض  
ط ↔ ظ  
ع ↔ غ  
ف ↔ ق  
ك ↔ ل  
م ↔ ن  
ه ↔ ة  
ي ↔ ن  
ى ↔ ي  

or any other letter that might cause confusion

4) Missing or extra dots.

5) OCR noise such as:
- merged words
- broken words
- duplicated words
- missing or extra spaces
- stretched letters
- punctuation differences
- minor formatting issues

These must NOT reduce language marks.

------------------------------------------------------------
LANGUAGE DETECTION
------------------------------------------------------------

Detect whether the student's writing is mostly Arabic or English.
ALL feedback must be written in that detected language.

------------------------------------------------------------
CONTENT GRADING (MODERATELY LENIENT)
------------------------------------------------------------

Be fair and slightly lenient.

If the student expresses the same idea using different wording,
count it as correct.

Deduct content marks ONLY if:

- A core idea is missing
- A required concept is absent
- Meaning is clearly incorrect

Do NOT deduct for wording differences.

------------------------------------------------------------
LANGUAGE GRADING RULE
------------------------------------------------------------

Language deduction rule:

it must be strict and real
Only count TRUE grammar or spelling mistakes
AFTER excluding all noise cases listed above.

You Cant deduct any grade if there is no mistakes

------------------------------------------------------------
PRESENTATION
------------------------------------------------------------

Ignore handwriting quality, layout, or page cleanliness.

Grade only meaning and language accuracy.

------------------------------------------------------------
GRADING
------------------------------------------------------------

Total marks = ${assignment.totalPoints}

Split marks into:

- Content
- Language

Determine weighting based on MODEL ANSWER.

------------------------------------------------------------
PROCESS
------------------------------------------------------------

1. Extract required ideas from MODEL.
2. Compare student meaning.
3. Identify missing core ideas.
4. Count REAL language mistakes only.
5. Apply: 4 mistakes = minus 1 mark.

------------------------------------------------------------
OUTPUT FORMAT INSIDE reasonForDeduction
------------------------------------------------------------

ONLY:

التقييم بالمضمون:
- اذكر النقص الحقيقي في الأفكار.
- درجة المضمون.

التقييم اللغوي:
- الأخطاء الحقيقية فقط (خطأ ← تصحيح).
- عدد الأخطاء.
- درجة اللغة (حسب قاعدة ٤ = درجة).

عدد الكلمات:
- تقدير عدد كلمات الطالب.
- العدد المطلوب إن وُجد.
- هل استوفى الشرط (نعم / لا).

STRICT:

- Do NOT teach.
- Do NOT summarize.
- Do NOT invent mistakes.
- Talk directly to the student.
-dont mention the rules and marking rules

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

        const payload = useOcrText ?
            buildDeterministicPayload([
                { text: prompt },
                { text: `MODEL_TEXT:\n${modelText}` },
                { text: `STUDENT_TEXT:\n${studentText}` },
            ]) :
            buildDeterministicPayload([
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
        const responsePayload = buildSubmissionResponse(submission, assignment, req.user?.role);

        res.status(201).json({
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

        res.status(500).json({
            message: err &&
                err.response &&
                err.response.data &&
                err.response.data.error ?
                err.response.data.error.message : err.message,
        });
    }
};

exports.getOcrHealth = async(req, res) => {
    try {
        const health = await checkVisionOcrHealth();
        return res.json({
            ok: true,
            service: "google-cloud-vision-ocr",
            ...health,
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            service: "google-cloud-vision-ocr",
            message: err.message,
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

        let studentText = "";
        let modelText = "";
        let useOcrText = true;
        try {
            studentText = await extractTextForGrading(studentPdf, "student submission");
            modelText = await extractTextForGrading(modelPdf, "model answer");
        } catch (ocrErr) {
            if (isOcrConfigError(ocrErr.message)) {
                useOcrText = false;
                console.warn(`OCR disabled for this request: ${ocrErr.message}`);
            } else {
                throw ocrErr;
            }
        }

        const prompt = `
You are a strict university professor.

Compare STUDENT_TEXT and MODEL_TEXT.
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

        const payload = useOcrText ?
            buildDeterministicPayload([
                { text: prompt },
                { text: `MODEL_TEXT:\n${modelText}` },
                { text: `STUDENT_TEXT:\n${studentText}` },
            ]) :
            buildDeterministicPayload([
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
