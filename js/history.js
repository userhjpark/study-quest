// Round-result record and the "최근 기록" list. Pure logic, no DOM.
// One record per finished round. rewards.js turns the same record into XP and coins.

export const HISTORY_LIMIT = 10;
export const ALL_SUBJECTS_LABEL = "전체 과목";

const MAX_TEXT = 80;

// Builds the record for a finished round. `run` is the quiz run state, `concepts` is used only to
// turn missed ids into text (so a concept deleted later still shows up in the history).
export function buildRoundRecord({ run, concepts, subject, now }) {
  const missedTerms = run.missedIds
    .map((id) => concepts.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => c.term);
  return {
    finishedAt: now,
    subject: subject || ALL_SUBJECTS_LABEL,
    score: run.score,
    correct: run.correct,
    total: run.total,
    retryCorrect: run.retryCorrect,
    retryTotal: run.retryTotal,
    missedTerms,
  };
}

// Adds a record to the front (newest first) and keeps only the newest HISTORY_LIMIT.
export function addRecord(history, record) {
  return [record, ...history].slice(0, HISTORY_LIMIT);
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRecord(r) {
  return (
    r !== null && typeof r === "object" &&
    Number.isFinite(r.finishedAt) &&
    typeof r.subject === "string" &&
    isCount(r.score) && isCount(r.correct) && isCount(r.total) &&
    isCount(r.retryCorrect) && isCount(r.retryTotal) &&
    r.correct <= r.total && r.retryCorrect <= r.retryTotal &&
    Array.isArray(r.missedTerms)
  );
}

// Saved data can be missing or broken (edited by hand, old version): keep only valid records.
export function sanitizeHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .map((r) => ({
      ...r,
      subject: r.subject.slice(0, MAX_TEXT),
      missedTerms: r.missedTerms.filter((t) => typeof t === "string").map((t) => t.slice(0, MAX_TEXT)),
    }))
    .slice(0, HISTORY_LIMIT);
}
