const axios = require("axios");

const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
const GENERAL_FLASH_FALLBACK_MODELS = [
  process.env.GEMINI_GENERAL_MODEL_FALLBACK,
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash-latest",

];

function getGeminiUrl(modelName) {
  const resolvedModel = String(modelName || DEFAULT_GEMINI_MODEL).trim();
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    resolvedModel +
    ":generateContent?key=" +
    process.env.GEMINI_API_KEY
  );
}

function getModelCandidates(modelName) {
  const requested = String(modelName || DEFAULT_GEMINI_MODEL).trim();
  if (!requested) return [DEFAULT_GEMINI_MODEL];

  if (!/flash/i.test(requested)) {
    return [requested];
  }

  return Array.from(new Set([requested, ...GENERAL_FLASH_FALLBACK_MODELS].filter(Boolean)));
}

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

async function callGemini(payload, modelName, retries = 2) {
  const modelCandidates = getModelCandidates(modelName);
  let lastError = null;

  for (const candidateModel of modelCandidates) {
    const geminiUrl = getGeminiUrl(candidateModel);
    try {
      const response = await axios.post(geminiUrl, payload, {
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
      const status = Number(err?.response?.status);
      const isModelNotFound = status === 404;
      lastError = err;

      if (isModelNotFound) {
        continue;
      }

      if (retries > 0) {
        return callGemini(payload, candidateModel, retries - 1);
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini request failed");
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

function normalizeScoreTotals(result, assignmentTotalPoints, strategy) {
  let calculatedTotal = 0;

  // Normalize numeric fields first
  if (!Array.isArray(result.questions)) result.questions = [];

  // Convert incoming marks to numbers safely
  result.questions = result.questions.map((q) => {
    const maxMarks = Number(q.maxMarks);
    const studentMarks = Number(q.studentMarks);
    return {
      ...q,
      maxMarks: Number.isFinite(maxMarks) ? maxMarks : 0,
      studentMarks: Number.isFinite(studentMarks) ? studentMarks : 0,
    };
  });

  // If this strategy requests PDF->assignment scaling, apply it only to the final total grade
  const shouldScale = strategy && strategy.scalePdfToAssignment;
  let scaleFactor = 1;
  if (shouldScale) {
    const pdfTotalMarks = result.questions.reduce((s, q) => s + (Number(q.maxMarks) || 0), 0);
    const assignmentTotal = Number(assignmentTotalPoints) || 0;

    if (pdfTotalMarks > 0 && assignmentTotal > 0) {
      scaleFactor = assignmentTotal / pdfTotalMarks;
    }
  }

  // Default (or post-scaling) normalization / sanity checks
  result.questions.forEach((q) => {
    if (q.studentMarks > q.maxMarks) q.studentMarks = q.maxMarks;
    if (q.studentMarks < 0) q.studentMarks = 0;
    q.marksLost = Number.isFinite(Number(q.maxMarks)) && Number.isFinite(Number(q.studentMarks)) ? (Number(q.maxMarks) - Number(q.studentMarks)) : 0;
    calculatedTotal += Number(q.studentMarks) || 0;
  });

  if (!shouldScale) {
    if (calculatedTotal !== Number(result.totalGrade)) {
      result.totalGrade = calculatedTotal;
    }
  } else {
    const scaledTotal = Math.ceil(calculatedTotal * scaleFactor);
    result.totalGrade = Math.min(Math.max(scaledTotal, 0), Number(assignmentTotalPoints) || 0);
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

  const aiText = await callGemini(payload, strategy?.modelName);
  let result = parseAiJson(aiText);

  if (typeof strategy.normalizeResult === "function") {
    result = strategy.normalizeResult(result);
  }

  result = normalizeScoreTotals(result, assignment.totalPoints, strategy);
  const feedbackText = strategy.buildFeedback(result);

  return {
    result,
    feedbackText,
  };
}

module.exports = {
  gradeWithStrategy,
};
