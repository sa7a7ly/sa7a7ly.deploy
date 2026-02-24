const generalStrategy = require("./strategies/generalStrategy");
const arabicEssayStrategy = require("./strategies/arabicEssayStrategy");

const GRADING_PROFILE = {
  GENERAL: "GENERAL",
  ARABIC_ESSAY: "ARABIC_ESSAY",
};

function normalizeGradingProfile(value) {
  if (!value) return GRADING_PROFILE.GENERAL;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === GRADING_PROFILE.ARABIC_ESSAY || normalized === "ARABIC") {
    return GRADING_PROFILE.ARABIC_ESSAY;
  }
  return GRADING_PROFILE.GENERAL;
}

function getGradingStrategy(assignment) {
  const profile = normalizeGradingProfile(assignment?.gradingProfile);
  if (profile === GRADING_PROFILE.ARABIC_ESSAY) {
    return arabicEssayStrategy;
  }
  return generalStrategy;
}

module.exports = {
  GRADING_PROFILE,
  normalizeGradingProfile,
  getGradingStrategy,
};

