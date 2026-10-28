// Run with: node tests/logic.test.js
// Tests pure logic only (no browser). Exits with code 1 if any test fails.

import assert from "node:assert/strict";
import { SAMPLE_CONCEPTS, addConcept, deleteConcept, sanitizeConcepts } from "../js/concepts.js";
import {
  canStartQuiz, pickOptions, pickNextConcept, weightOf, recordAnswer,
  nextCombo, comboBonus, pointsForAnswer, shuffle, roundLength,
} from "../js/quiz.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok   " + name);
  } catch (err) {
    failed++;
    console.log("  FAIL " + name + "\n       " + err.message);
  }
}

// Small deterministic random generator so tests give the same result every run.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const mk = (id, def) => ({ id, term: "T" + id, definition: def });

console.log("concepts");
test("sample concepts allow a quiz", () => {
  assert.equal(canStartQuiz(SAMPLE_CONCEPTS).ok, true);
});
test("addConcept adds a trimmed pair", () => {
  const r = addConcept([], "  Term ", " Def  ");
  assert.equal(r.error, null);
  assert.equal(r.concepts[0].term, "Term");
  assert.equal(r.concepts[0].definition, "Def");
});
test("addConcept rejects empty fields", () => {
  assert.ok(addConcept([], "", "x").error);
  assert.ok(addConcept([], "x", "   ").error);
});
test("addConcept rejects a duplicate term (case-insensitive)", () => {
  const list = [mk("1", "a")];
  assert.ok(addConcept(list, "t1", "other").error);
});
test("deleteConcept removes only that id", () => {
  const list = [mk("1", "a"), mk("2", "b")];
  assert.deepEqual(deleteConcept(list, "1").map((c) => c.id), ["2"]);
});
test("sanitizeConcepts drops broken entries", () => {
  assert.equal(sanitizeConcepts("nope"), null);
  assert.equal(sanitizeConcepts([mk("1", "a"), { id: 5 }, null]).length, 1);
});

console.log("quiz start rules");
test("EDGE CASE: fewer than 4 concepts blocks the quiz", () => {
  const r = canStartQuiz([mk("1", "a"), mk("2", "b"), mk("3", "c")]);
  assert.equal(r.ok, false);
  assert.match(r.message, /at least 4/);
});
test("EDGE CASE: 4 concepts but only 3 different definitions blocks the quiz", () => {
  const r = canStartQuiz([mk("1", "a"), mk("2", "b"), mk("3", "c"), mk("4", "A ")]);
  assert.equal(r.ok, false);
});
test("exactly 4 distinct concepts is allowed", () => {
  assert.equal(canStartQuiz([mk("1", "a"), mk("2", "b"), mk("3", "c"), mk("4", "d")]).ok, true);
});

console.log("option picking");
test("returns 4 distinct options including the correct one", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rng = seeded(seed);
    const target = SAMPLE_CONCEPTS[seed % SAMPLE_CONCEPTS.length];
    const { options, correctIndex } = pickOptions(target, SAMPLE_CONCEPTS, rng);
    assert.equal(options.length, 4);
    assert.equal(new Set(options).size, 4);
    assert.equal(options[correctIndex], target.definition);
  }
});
test("skips wrong options equal to the correct definition", () => {
  const list = [mk("1", "same"), mk("2", "Same "), mk("3", "b"), mk("4", "c"), mk("5", "d")];
  for (let seed = 1; seed <= 30; seed++) {
    const { options, correctIndex } = pickOptions(list[0], list, seeded(seed));
    const wrong = options.filter((_, i) => i !== correctIndex);
    assert.ok(wrong.every((w) => w.trim().toLowerCase() !== "same"));
    assert.equal(new Set(wrong.map((w) => w.trim().toLowerCase())).size, 3);
  }
});
test("returns null when 3 distinct wrong options do not exist", () => {
  const list = [mk("1", "a"), mk("2", "a"), mk("3", "b"), mk("4", "c")];
  assert.equal(pickOptions(list[0], list, seeded(1)), null);
});
test("shuffle keeps all items", () => {
  assert.deepEqual([...shuffle([1, 2, 3, 4], seeded(3))].sort(), [1, 2, 3, 4]);
});

console.log("missed-concept weighting");
test("weight grows with misses and is capped", () => {
  assert.equal(weightOf({}, "a"), 1);
  assert.equal(weightOf({ a: 2 }, "a"), 3);
  assert.equal(weightOf({ a: 99 }, "a"), 6);
});
test("recordAnswer: wrong raises, correct lowers, zero is removed", () => {
  let m = recordAnswer({}, "a", false);
  m = recordAnswer(m, "a", false);
  assert.equal(m.a, 2);
  m = recordAnswer(m, "a", true);
  assert.equal(m.a, 1);
  m = recordAnswer(m, "a", true);
  assert.equal("a" in m, false);
});
test("recordAnswer does not change the old object", () => {
  const old = { a: 1 };
  recordAnswer(old, "a", false);
  assert.equal(old.a, 1);
});
test("missed concept is drawn more often than the others", () => {
  const list = [mk("a", "1"), mk("b", "2"), mk("c", "3"), mk("d", "4")];
  const rng = seeded(7);
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 4000; i++) counts[pickNextConcept(list, { a: 5 }, rng).id]++;
  assert.ok(counts.a > counts.b * 2, JSON.stringify(counts));
});
test("EVIDENCE: 1000 picks, frequently-missed vs never-missed concept", () => {
  // 4 concepts. "a" was missed 3 times (weight 4); b, c, d were never missed (weight 1).
  const list = [mk("a", "1"), mk("b", "2"), mk("c", "3"), mk("d", "4")];
  const missed = { a: 3 };
  const rng = seeded(2024);
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 1000; i++) counts[pickNextConcept(list, missed, rng).id]++;
  const neverMissedAvg = (counts.b + counts.c + counts.d) / 3;
  const ratio = counts.a / neverMissedAvg;
  console.log("       picks out of 1000 -> missed a: " + counts.a +
    " | never-missed b: " + counts.b + ", c: " + counts.c + ", d: " + counts.d);
  console.log("       missed concept appeared " + ratio.toFixed(2) +
    "x as often as a never-missed one (expected about 4x)");
  assert.ok(ratio > 3 && ratio < 5, "ratio was " + ratio.toFixed(2));
});
test("never repeats the previous concept when others exist", () => {
  const list = [mk("a", "1"), mk("b", "2")];
  const rng = seeded(11);
  for (let i = 0; i < 100; i++) assert.equal(pickNextConcept(list, { a: 5 }, rng, "a").id, "b");
});

console.log("round length");
test("a round is 10 questions when there are 10 or more concepts", () => {
  const many = Array.from({ length: 15 }, (_, i) => mk(String(i), "d" + i));
  assert.equal(roundLength(many), 10);
  assert.equal(roundLength(many.slice(0, 10)), 10);
});
test("a round is shorter when there are fewer than 10 concepts", () => {
  assert.equal(roundLength(SAMPLE_CONCEPTS), 5);
  assert.equal(roundLength([mk("1", "a"), mk("2", "b"), mk("3", "c"), mk("4", "d"), mk("5", "e"), mk("6", "f")]), 6);
});

console.log("combo and points");
test("combo grows on correct and resets on wrong", () => {
  assert.equal(nextCombo(2, true), 3);
  assert.equal(nextCombo(5, false), 0);
});
test("combo bonus: none for 1st, then +5 per step, capped", () => {
  assert.equal(comboBonus(0), 0);
  assert.equal(comboBonus(1), 0);
  assert.equal(comboBonus(2), 5);
  assert.equal(comboBonus(4), 15);
  assert.equal(comboBonus(6), 25);
  assert.equal(comboBonus(50), 25);
});
test("points: wrong answer gives 0, correct gives base + bonus", () => {
  assert.equal(pointsForAnswer(false, 0), 0);
  assert.equal(pointsForAnswer(true, 1), 10);
  assert.equal(pointsForAnswer(true, 3), 20);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
