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
export function canStartQuiz(concepts) {
  if (concepts.length < MIN_CONCEPTS) {
    return {
      ok: false,
      message: `You need at least ${MIN_CONCEPTS} concepts to start a quiz. You have ${concepts.length}.`,
    };
  }
  if (distinctDefinitions(concepts).size < OPTION_COUNT) {
    return {
      ok: false,
      message: `You need at least ${OPTION_COUNT} concepts with different definitions to start a quiz.`,
    };
  }
  return { ok: true, message: "" };
}

// One round is 10 questions, or fewer when there are fewer than 10 concepts.
// Concepts may repeat inside a round (missed ones more often), so this is a cap
// by concept count, not a "each concept once" rule.
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

// Weighted random pick. Avoids repeating the previous concept when possible.
export function pickNextConcept(concepts, missed, rng = Math.random, lastId = null) {
  let pool = concepts;
  if (concepts.length > 1) pool = concepts.filter((c) => c.id !== lastId);
  const total = pool.reduce((sum, c) => sum + weightOf(missed, c.id), 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= weightOf(missed, c.id);
    if (roll < 0) return c;
  }
  return pool[pool.length - 1];
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
