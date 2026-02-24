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

function normalizeResult(result) {
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

function isArabicResult(result) {
  const languageText = String(result?.detectedLanguage || "").toLowerCase();
  return languageText.includes("arabic") || languageText === "ar";
}

function buildPrompt(assignment) {
  return `
You are a strict university professor.

First, detect the primary language of the assignment (Arabic or English).
If the assignment content is mostly Arabic, ALL feedback must be written in Arabic.
If the assignment content is mostly English, ALL feedback must be written in English.

Compare the STUDENT PDF and MODEL ANSWER PDF.
Ignore page cleanliness, handwriting quality, crossings-out, or any visual mess; grade only the written content.

GRADING RULES:

If the MODEL ANSWER includes a mark scheme, rubric, or explicit marking criteria:
- Follow it strictly as the highest priority.
- Do not use a different grading style.
- Do not change weights, criteria, or distribution defined by that mark scheme.
- If two interpretations are possible, choose the one most consistent with the given mark scheme.

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

Perform at least 3 verification passes before final output:
Pass 1: Grade each question using the mark scheme/rubric.
Pass 2: Re-check every deduction against evidence from student answer and mark scheme.
Pass 3: Recalculate totals and JSON consistency checks.

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
}

function buildFeedback(result) {
  const isArabic = isArabicResult(result);
  let feedbackText = isArabic ? "تفصيل الدرجات:\n\n" : "Question Breakdown:\n\n";

  if (result.questions && result.questions.length > 0) {
    result.questions.forEach((q) => {
      const questionReason = resolveQuestionReason(q);
      feedbackText += `${q.questionNumber}\n`;
      feedbackText += isArabic ? `الدرجة الكلية: ${q.maxMarks}\n` : `Max Marks: ${q.maxMarks}\n`;
      feedbackText += isArabic ? `درجتك: ${q.studentMarks}\n` : `Your Marks: ${q.studentMarks}\n`;
      feedbackText += isArabic
        ? `الدرجات المفقودة: ${q.marksLost}\n`
        : `Marks Lost: ${q.marksLost}\n`;
      feedbackText += isArabic ? `سبب الخصم: ${questionReason}\n\n` : `Reason: ${questionReason}\n\n`;
    });
  }

  feedbackText += "Overall Summary:\n" + (result.overallSummary || "No summary provided.") + "\n\n";

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

  return feedbackText.trim();
}

module.exports = {
  buildPrompt,
  normalizeResult,
  buildFeedback,
};

