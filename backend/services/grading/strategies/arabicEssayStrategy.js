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

function buildPrompt(assignment) {
  return `
You are a strict academic examiner.

The MODEL ANSWER is the ONLY source of truth.

------------------------------------------------------------
STEP 1 - MODEL ANALYSIS (MANDATORY FIRST)
------------------------------------------------------------

Read the MODEL ANSWER exhaustively, word by word.

Infer ONLY from it:
- Required ideas
- Required structure
- Required language level
- Mandatory elements

Do NOT assume anything not explicitly present.

------------------------------------------------------------
STEP 2 - LANGUAGE DETECTION
------------------------------------------------------------

Detect whether the student writing is mostly Arabic or English.
All feedback must be written in that same language.

------------------------------------------------------------
STEP 3 - LANGUAGE EVALUATION (FIRST SPELLING, THEN GRAMMAR)
------------------------------------------------------------

LANGUAGE TOTAL = ${assignment.totalPoints} / 2

A) SPELLING (EXHAUSTIVE, WORD BY WORD)

Scan the STUDENT text word by word.
List ALL genuine spelling mistakes (خطأ ← تصحيح).

NOISE RULE (CRITICAL):
The following MUST NEVER be counted or listed as mistakes:
- OCR artifacts
- Handwriting ambiguity
- ة/ه - ا/أ/إ/آ - ى/ي - ر/ز - د/ذ - ص/ض - ع/غ
- Scribbles or unclear strokes Ignore them completely.

B) GRAMMAR & STYLE

After removing noise, evaluate:
- Grammar
- Sentence structure
- Clarity
- Expression quality

C) LANGUAGE MARKING

Every 4 genuine language mistakes (spelling + grammar combined) = -1 mark.

Do NOT deduct for noise.

------------------------------------------------------------
STEP 4 - CONTENT EVALUATION (STRICT)
------------------------------------------------------------

CONTENT TOTAL = ${assignment.totalPoints} / 2

Compare student content directly to the MODEL.

Identify:
- Missing required ideas
- Incorrect ideas
- Weak development

Deduct marks based ONLY on MODEL importance.

------------------------------------------------------------

Inside "reasonForDeduction", output ONLY:

التقييم بالمضمون:
- الأخطاء أو النقص مقارنة بالإجابة الصحيحة.
- درجة المضمون.

التقييم اللغوي:
- جميع الأخطاء الإملائية الحقيقية (خطأ ← تصحيح).
- الأخطاء النحوية أو الأسلوبية.
- عدد الأخطاء الكلي.
- درجة اللغة.

عدد الكلمات:
- التقدير التقريبي.
- المطلوب إن وُجد.
- هل استوفى الشرط (نعم/لا).

STRICT:
- No extra sections.
- No summaries.
- No teaching.
- No invented errors.
- Speak directly to the student.
- Do NOT mention the model.

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
studentMarks <= maxMarks
marksLost = maxMarks - studentMarks
totalGrade = studentMarks

Return ONLY pure JSON.
`;
}

function normalizeResult(result) {
  return result;
}

function buildFeedback(result) {
  const isArabic = String(result?.detectedLanguage || "").toLowerCase() === "arabic";
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

  return feedbackText.trim();
}

module.exports = {
  modelName: "gemini-3.1-pro-preview",
  buildPrompt,
  normalizeResult,
  buildFeedback,
};
