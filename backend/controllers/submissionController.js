const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");

exports.submitAssignment = async(req, res) => {
    try {
        const assignmentId = req.body.assignmentId;
        const studentId = req.body.studentId;

        if (!req.file) {
            return res.status(400).json({ message: "Student PDF missing" });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        const studentPdf = fs.readFileSync(req.file.path);
        const modelPdf = fs.readFileSync(assignment.modelAnswerPdfPath);

        // 🔒 Deterministic identical-file check
        const studentHash = crypto.createHash("sha256").update(studentPdf).digest("hex");
        const modelHash = crypto.createHash("sha256").update(modelPdf).digest("hex");

        if (studentHash === modelHash) {
            const submission = await Submission.create({
                assignmentId: assignmentId,
                studentId: studentId,
                pdfPath: req.file.path,
                grade: assignment.totalPoints,
                feedback: "Identical to model answer. Full marks awarded.",
                gradedAt: new Date()
            });

            return res.status(201).json(submission);
        }

        const GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" +
            process.env.GEMINI_API_KEY;

        const geminiResponse = await axios.post(GEMINI_URL, {
            contents: [{
                parts: [{
                        text: `You are a strict but fair university instructor.

Compare the STUDENT PDF with the MODEL ANSWER PDF.

Return JSON ONLY in this exact format:

{
  "grade": number,
  "summary": "2–3 sentence overall evaluation",
  "strengths": ["point 1", "point 2"],
  "mistakes": ["mistake 1", "mistake 2"],
  "improvements": ["specific actionable advice"]
}

Rules:
- Grade must be from 0 to ${assignment.totalPoints}
- Do NOT invent mistakes
- If answers match the model, mistakes must be an empty array`
                    },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: studentPdf.toString("base64")
                        }
                    },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: modelPdf.toString("base64")
                        }
                    }
                ]
            }]
        });

        // Safe response extraction (no optional chaining)
        let aiText = null;

        if (
            geminiResponse &&
            geminiResponse.data &&
            geminiResponse.data.candidates &&
            geminiResponse.data.candidates.length > 0 &&
            geminiResponse.data.candidates[0].content &&
            geminiResponse.data.candidates[0].content.parts &&
            geminiResponse.data.candidates[0].content.parts.length > 0
        ) {
            aiText = geminiResponse.data.candidates[0].content.parts[0].text;
        }

        if (!aiText) {
            throw new Error("Empty Gemini response");
        }

        const cleaned = aiText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const result = JSON.parse(cleaned);

        // 🧠 Anti-hallucination safeguard
        if (
            result.mistakes &&
            result.mistakes.length === 0 &&
            result.grade < assignment.totalPoints
        ) {
            result.grade = assignment.totalPoints;
        }

        // 📝 Build human-readable feedback
        let feedbackText = result.summary + "\n\n";

        if (result.strengths && result.strengths.length > 0) {
            feedbackText += "Strengths:\n";
            for (let i = 0; i < result.strengths.length; i++) {
                feedbackText += "- " + result.strengths[i] + "\n";
            }
        }

        if (result.mistakes && result.mistakes.length > 0) {
            feedbackText += "\nMistakes:\n";
            for (let i = 0; i < result.mistakes.length; i++) {
                feedbackText += "- " + result.mistakes[i] + "\n";
            }
        }

        if (result.improvements && result.improvements.length > 0) {
            feedbackText += "\nHow to improve:\n";
            for (let i = 0; i < result.improvements.length; i++) {
                feedbackText += "- " + result.improvements[i] + "\n";
            }
        }

        const submission = await Submission.create({
            assignmentId: assignmentId,
            studentId: studentId,
            pdfPath: req.file.path,
            grade: result.grade,
            feedback: feedbackText.trim(),
            gradedAt: new Date()
        });

        res.status(201).json(submission);

    } catch (err) {
        console.error(
            "SUBMISSION ERROR:",
            err && err.response && err.response.data ? err.response.data : err
        );

        res.status(500).json({
            message: err && err.response && err.response.data && err.response.data.error ?
                err.response.data.error.message :
                err.message
        });
    }
};

// GET submissions
exports.getSubmissions = async(req, res) => {
    const query = req.query.assignmentId ?
        { assignmentId: req.query.assignmentId } :
        {};

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