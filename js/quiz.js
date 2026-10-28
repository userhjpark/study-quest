// Quiz logic: pure functions, no DOM and no storage.
// `rng` is a function returning a number in [0, 1). Tests pass a fixed one.

export const ROUND_LENGTH = 10;
export const MIN_CONCEPTS = 4;
export const OPTION_COUNT = 4;
export const BASE_POINTS = 10;
export const COMBO_STEP = 5;
export const MAX_COMBO_BONUS_STEPS = 5;
const MAX_MISS_WEIGHT = 5;

const norm = (text) => text.trim().toLowerCase();

function distinctDefinitions(concepts) {
  return new Set(concepts.map((c) => norm(c.definition)));
}

// The quiz needs 4 concepts AND 4 different definitions, otherwise we could not
// build 4 distinct options.
// `concepts` is the pool for the chosen subject. `scopeLabel` is that subject's name
// (or null for all subjects) and is only used to make the message clearer.
export function canStartQuiz(concepts, scopeLabel = null) {
  const where = scopeLabel ? `'${scopeLabel}' 과목에는` : "지금은";
  if (concepts.length < MIN_CONCEPTS) {
    return {
      ok: false,
      message: `퀴즈를 시작하려면 개념이 최소 ${MIN_CONCEPTS}개 필요해요. ${where} ${concepts.length}개예요.`,
    };
  }
  if (distinctDefinitions(concepts).size < OPTION_COUNT) {
    return {
      ok: false,
      message: `퀴즈를 시작하려면 서로 다른 정의를 가진 개념이 최소 ${OPTION_COUNT}개 필요해요.`,
    };
  }
  return { ok: true, message: "" };
}

// The main part of a round has 10 questions, or fewer when there are fewer than 10
// concepts (each concept is asked at most once, see buildRound).
export function roundLength(concepts) {
  return Math.min(ROUND_LENGTH, concepts.length);
}

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Correct definition + 3 wrong ones taken from OTHER concepts.
// Wrong options are distinct from each other and never equal the correct one.
export function pickOptions(concept, concepts, rng = Math.random) {
  const correct = concept.definition;
  const seen = new Set([norm(correct)]);
  const wrong = [];
  for (const other of shuffle(concepts, rng)) {
    if (other.id === concept.id) continue;
    const key = norm(other.definition);
    if (seen.has(key)) continue;
    seen.add(key);
    wrong.push(other.definition);
    if (wrong.length === OPTION_COUNT - 1) break;
  }
  if (wrong.length < OPTION_COUNT - 1) return null;
  const options = shuffle([correct, ...wrong], rng);
  return { options, correctIndex: options.indexOf(correct) };
}

// missed = { conceptId: timesMissed }. A concept missed more often is drawn more often.
export function weightOf(missed, id) {
  return 1 + Math.min(missed[id] || 0, MAX_MISS_WEIGHT);
}

// Picks `count` DISTINCT items by weighted random draw (a drawn item is removed from the pool).
function sampleDistinct(items, count, weightFn, rng) {
  const pool = [...items];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + weightFn(item), 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weightFn(pool[i]);
      if (roll < 0) { index = i; break; }
    }
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

// The main part of a round: each concept at most once.
//  - 10 concepts or fewer: all of them, in random order.
//  - more than 10: 10 distinct ones; frequently-missed concepts are more likely to be chosen.
export function buildRound(concepts, missed, rng = Math.random) {
  const chosen = sampleDistinct(concepts, roundLength(concepts), (c) => weightOf(missed, c.id), rng);
  return shuffle(chosen, rng);
}

// "다시 풀기" part: the concepts answered wrong in the main part, once more, in the order they were asked.
export function buildRetry(round, missedIds) {
  const wrong = new Set(missedIds);
  return round.filter((c) => wrong.has(c.id));
}

// What comes after the current question: another question of this part, the retry part, or the results.
//   phase: "main" | "retry"; index: 0-based position; length: questions in this part;
//   missedCount: concepts answered wrong so far in the main part (including the current answer).
export function nextStep({ phase, index, length, missedCount }) {
  if (index + 1 < length) return "next";
  if (phase === "main" && missedCount > 0) return "retry";
  return "results";
}

export function progressLabel({ phase, index, length }) {
  const position = `${index + 1} / ${length}`;
  return phase === "retry" ? `다시 풀기 ${position} · 이 개념의 정의는?` : `${position} · 이 개념의 정의는?`;
}

// A wrong answer raises the miss count; a correct answer lowers it until it is gone.
export function recordAnswer(missed, id, correct) {
  const next = { ...missed };
  const count = next[id] || 0;
  if (correct) {
    if (count <= 1) delete next[id];
    else next[id] = count - 1;
  } else {
    next[id] = count + 1;
  }
  return next;
}

export function nextCombo(combo, correct) {
  return correct ? combo + 1 : 0;
}

// Combo bonus starts at the 2nd correct answer in a row and is capped.
export function comboBonus(combo) {
  if (combo < 2) return 0;
  return Math.min(combo - 1, MAX_COMBO_BONUS_STEPS) * COMBO_STEP;
}

// `combo` is the streak INCLUDING this answer (0 if the answer was wrong).
export function pointsForAnswer(correct, combo) {
  return correct ? BASE_POINTS + comboBonus(combo) : 0;
}
