const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const ResubmissionRequest = require("../models/ResubmissionRequest");

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

exports.submitAssignment = async(req, res) => {
    try {
        const { assignmentId, studentId } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Student PDF missing" });
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

        const studentPdf = fs.readFileSync(req.file.path);
        const modelPdf = fs.readFileSync(assignment.modelAnswerPdfPath);

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
            const submission = await Submission.create({
                assignmentId,
                studentId,
                pdfPath: req.file.path,
                grade: assignment.totalPoints,
                feedback: "Identical to model answer. Full marks awarded.",
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

        // 🔥 STRICT PROMPT
        const prompt = `
You are an extremely strict university professor.

Compare the STUDENT PDF and MODEL ANSWER PDF.

STRICT GRADING RULES:

1) Extract all questions from MODEL ANSWER.
2) Grade EACH question separately.
3) Deduct marks for:
   - Missing steps
   - Missing formulas
   - Missing explanations
   - Logical mistakes
   - Weak justification
   - Incomplete answer
4) If something is not written, it is WRONG.
5) DO NOT assume intention.
6) DO NOT mix questions.
7) Be extremely strict.

DOUBLE CHECK BEFORE RETURNING:
- Sum of studentMarks must equal totalGrade.
- studentMarks <= maxMarks.
- marksLost = maxMarks - studentMarks.
- No invented mistakes.

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

        const submission = await Submission.create({
            assignmentId,
            studentId,
            pdfPath: req.file.path,
            grade: result.totalGrade,
            feedback: feedbackText.trim(),
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

// GET submissions
exports.getSubmissions = async(req, res) => {
    const query = req.query.assignmentId ? { assignmentId: req.query.assignmentId } : {};

    const submissions = await Submission.find(query)
        .populate("studentId", "name email")
        .populate("assignmentId", "title");

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
        const { assignmentId, studentId } = req.query;
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
