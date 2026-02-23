"use strict";

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
const ARABIC_ONLY_RE = /^[\u0600-\u06FF]+$/;
const MULTI_SPACE_RE = /\s+/g;
const TATWEEL_RE = /\u0640/g;
const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670]/g;
const REPEATED_CHAR_RUN_RE = /(.)\1{3,}/;

const VALID_SINGLE_CHAR_WORDS = new Set(["و", "ف", "ب", "ك", "ل", "ت"]);
const COMMON_ARABIC_WORDS = new Set([
    "في",
    "من",
    "عن",
    "على",
    "الى",
    "إلى",
    "ثم",
    "قد",
    "لن",
    "لم",
    "لا",
    "ما",
    "هو",
    "هي",
    "هم",
    "هن",
    "هذا",
    "هذه",
    "ذلك",
    "تلك",
    "هناك",
    "هنا",
    "كل",
    "تم",
    "مع",
    "كان",
    "كانت",
    "بعد",
    "قبل",
    "بين",
    "او",
    "أو",
    "اي",
    "أي",
]);
const ARABIC_PREFIXES = ["ال", "وال", "فال", "بال", "كال", "لل"];

function normalizeArabicToken(token) {
    if (!token) return "";
    return token
        .replace(TATWEEL_RE, "")
        .replace(ARABIC_DIACRITICS_RE, "")
        .replace(/[إأآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .trim();
}

function countArabicChars(token) {
    const matches = token.match(/[\u0600-\u06FF]/g);
    return matches ? matches.length : 0;
}

function countVisibleChars(token) {
    return token.replace(/\s/g, "").length;
}

function isMostlyNonArabic(token) {
    const visible = countVisibleChars(token);
    if (!visible) return true;

    const arabicCount = countArabicChars(token);
    if (!arabicCount) return true;

    return arabicCount / visible < 0.5;
}

function isLikelyScribbleNoise(token) {
    if (!token) return true;

    if (!ARABIC_CHAR_RE.test(token) && /[^a-zA-Z0-9]/.test(token)) return true;
    if (REPEATED_CHAR_RUN_RE.test(token)) return true;
    if (isMostlyNonArabic(token)) return true;

    return false;
}

function isMeaningfulShortToken(token) {
    if (!token) return false;
    if (token.length === 1) return VALID_SINGLE_CHAR_WORDS.has(token);
    if (token.length === 2) return COMMON_ARABIC_WORDS.has(token) || ARABIC_ONLY_RE.test(token);
    return true;
}

function shouldDropToken(token) {
    if (!token) return true;

    const normalized = normalizeArabicToken(token);
    if (!normalized) return true;
    if (isLikelyScribbleNoise(normalized)) return true;
    if (!ARABIC_ONLY_RE.test(normalized)) return true;
    if (normalized.length < 2 && !isMeaningfulShortToken(normalized)) return true;

    return false;
}

function canMergeTokens(left, right) {
    if (!left || !right) return false;
    if (!ARABIC_ONLY_RE.test(left) || !ARABIC_ONLY_RE.test(right)) return false;

    const l = normalizeArabicToken(left);
    const r = normalizeArabicToken(right);

    if (COMMON_ARABIC_WORDS.has(l) || COMMON_ARABIC_WORDS.has(r)) return false;
    if (VALID_SINGLE_CHAR_WORDS.has(l) || VALID_SINGLE_CHAR_WORDS.has(r)) return false;

    const totalLen = l.length + r.length;
    if (totalLen < 4 || totalLen > 10) return false;

    if (ARABIC_PREFIXES.some((p) => l.startsWith(p)) && l.length <= 5 && r.length <= 5) {
        return true;
    }
    if (r.length <= 3 && l.length >= 2 && l.length <= 6) {
        return true;
    }

    return false;
}

function mergeBrokenArabicWords(tokens) {
    const merged = [];
    let i = 0;

    while (i < tokens.length) {
        const current = tokens[i];
        const next = tokens[i + 1];

        if (next && canMergeTokens(current, next)) {
            merged.push(current + next);
            i += 2;
            continue;
        }

        merged.push(current);
        i += 1;
    }

    return merged;
}

function cleanArabicOcrText(text) {
    if (typeof text !== "string") return "";
    if (!text.trim()) return "";

    const normalizedInput = text.replace(MULTI_SPACE_RE, " ").trim();
    const rawTokens = normalizedInput.split(" ").map(normalizeArabicToken).filter(Boolean);
    const filtered = rawTokens.filter((token) => !shouldDropToken(token));
    const merged = mergeBrokenArabicWords(filtered);

    return merged.join(" ").replace(MULTI_SPACE_RE, " ").trim();
}

module.exports = {
    cleanArabicOcrText,
};
