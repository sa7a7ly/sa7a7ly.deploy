const fs = require("fs");
const axios = require("axios");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");

exports.submitAssignment = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Student PDF missing" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });

    const studentPdf = fs.readFileSync(req.file.path);
    const modelPdf = fs.readFileSync(assignment.modelAnswerPdfPath);

    const GEMINI_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" +
      process.env.GEMINI_API_KEY;

    const geminiResponse = await axios.post(GEMINI_URL, {
      contents: [
        {
          parts: [
            {
              text: `
You are a strict teacher.

Compare STUDENT PDF with MODEL ANSWER PDF.

Return JSON ONLY:

{
 "grade": number,
 "feedback": string
}

Grade from 0 to ${assignment.totalPoints}.
`
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
        }
      ]
    });

    const aiText =
      geminiResponse.data.candidates[0].content.parts[0].text;

    console.log("RAW GEMINI:", aiText);

    const result = JSON.parse(aiText);

    const submission = await Submission.create({
      assignmentId,
      studentId,
      pdfPath: req.file.path,
      grade: result.grade,
      feedback: result.feedback,
      gradedAt: new Date()
    });

    res.status(201).json(submission);

  } catch (err) {
    console.error("SUBMISSION ERROR:", err.response?.data || err);
    res.status(500).json({ message: err.message });
  }
};

// GET submissions
exports.getSubmissions = async (req, res) => {
  const query = req.query.assignmentId
    ? { assignmentId: req.query.assignmentId }
    : {};

  const submissions = await Submission.find(query)
    .populate("studentId", "name email")
    .populate("assignmentId", "title");

  res.json(submissions);
};

exports.getSubmission = async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate("studentId", "name email")
    .populate("assignmentId", "title totalPoints");

  if (!submission)
    return res.status(404).json({ message: "Submission not found" });

  res.json(submission);
};
