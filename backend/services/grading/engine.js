const axios = require("axios");

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=" +
  process.env.GEMINI_API_KEY;

const DETERMINISTIC_GENERATION_CONFIG = {
  temperature: 0,
  topK: 1,
  topP: 0,
  candidateCount: 1,
  seed: 42,
  responseMimeType: "application/json",
};


function buildDeterministicPayload(parts) {
  return {
    contents: [{ parts }],
    generationConfig: DETERMINISTIC_GENERATION_CONFIG,
  };
}

async function callGemini(payload, retries = 2) {
  try {
    const response = await axios.post(GEMINI_URL, payload, {
      timeout: 600000,
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
      return callGemini(payload, retries - 1);
    }
    throw err;
  }
}

function parseAiJson(aiText) {
  const cleaned = String(aiText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

function normalizeScoreTotals(result, assignmentTotalPoints) {
  let calculatedTotal = 0;

  if (Array.isArray(result.questions)) {
    result.questions.forEach((q) => {
      const maxMarks = Number(q.maxMarks);
      const studentMarks = Number(q.studentMarks);
      q.maxMarks = Number.isFinite(maxMarks) ? maxMarks : 0;
      q.studentMarks = Number.isFinite(studentMarks) ? studentMarks : 0;
      if (q.studentMarks > q.maxMarks) {
        q.studentMarks = q.maxMarks;
      }
      if (q.studentMarks < 0) {
        q.studentMarks = 0;
      }
      q.marksLost = q.maxMarks - q.studentMarks;
      calculatedTotal += q.studentMarks;
    });
  }

  if (calculatedTotal !== Number(result.totalGrade)) {
    result.totalGrade = calculatedTotal;
  }

  if (result.totalGrade > assignmentTotalPoints) {
    result.totalGrade = assignmentTotalPoints;
  }
  if (result.totalGrade < 0) {
    result.totalGrade = 0;
  }

  return result;
}

async function gradeWithStrategy({
  strategy,
  assignment,
  studentPdf,
  studentMimeType,
  modelPdf,
}) {
  const prompt = strategy.buildPrompt(assignment);
  const payload = buildDeterministicPayload([
    { text: prompt },
    {
      inlineData: {
        mimeType: studentMimeType || "application/pdf",
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

  const aiText = await callGemini(payload);
  let result = parseAiJson(aiText);

  if (typeof strategy.normalizeResult === "function") {
    result = strategy.normalizeResult(result);
  }

  result = normalizeScoreTotals(result, assignment.totalPoints);
  const feedbackText = strategy.buildFeedback(result);

  return {
    result,
    feedbackText,
  };
}

module.exports = {
  gradeWithStrategy,
};

