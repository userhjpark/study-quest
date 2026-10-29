// Run with: node tests/logic.test.js
// Tests pure logic only (no browser). Exits with code 1 if any test fails.

import assert from "node:assert/strict";
import {
  SAMPLE_CONCEPTS, DEFAULT_SUBJECT, ALL_SUBJECTS, addConcept, addMany, deleteConcept, sanitizeConcepts,
  listSubjects, filterBySubject, resolveSubject, isDuplicate,
  normalizeFilter, groupBySubject, visibleGroups,
} from "../js/concepts.js";
import { detectSeparator, parseLines, buildPreview, MAX_IMPORT } from "../js/importer.js";
import {
  canStartQuiz, pickOptions, weightOf, recordAnswer, buildRound, buildRetry, nextStep, progressLabel,
  nextCombo, comboBonus, pointsForAnswer, shuffle, roundLength,
} from "../js/quiz.js";

import {
  buildRoundRecord, addRecord, sanitizeHistory, HISTORY_LIMIT, ALL_SUBJECTS_LABEL,
} from "../js/history.js";

import {
  DAILY_XP_CAP, TIMER_BONUS_XP, TIMER_BONUS_COINS, TIMER_BONUS_MAX_PER_DAY,
  freshProfile, sanitizeProfile, dateKey, xpForLevel, levelForXp, levelProgress,
  rewardsForRound, applyRound, applyTimerBonus, xpLeftToday,
  CHECKIN_XP, applyCheckIn, canCheckIn, currentStreak,
  xpEarnedToday, applyRoundWithCheckIn, applyTimerWithCheckIn,
} from "../js/rewards.js";

import {
  DURATIONS, startTimer, remainingMs, isFinished, progress, formatRemaining, sanitizeTimer,
  isPaused, pauseTimer, resumeTimer,
} from "../js/timer.js";

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

const mk = (id, def, subject = "S") => ({ id, subject, term: "T" + id, definition: def });
const mkIn = (id, term, subject) => ({ id, subject, term, definition: "def of " + term });

console.log("concepts");
test("sample concepts allow a quiz", () => {
  assert.equal(canStartQuiz(SAMPLE_CONCEPTS).ok, true);
});
test("samples have two subjects with at least 4 concepts each", () => {
  const subjects = listSubjects(SAMPLE_CONCEPTS);
  assert.deepEqual(subjects.map((s) => s.name).sort(), ["생명과학", "한국사"].sort());
  assert.ok(subjects.every((s) => s.count >= 4));
  for (const s of subjects) assert.equal(canStartQuiz(filterBySubject(SAMPLE_CONCEPTS, s.name), s.name).ok, true);
});
test("addConcept adds a trimmed pair with the default subject", () => {
  const r = addConcept([], "  Term ", " Def  ");
  assert.equal(r.error, null);
  assert.equal(r.concepts[0].term, "Term");
  assert.equal(r.concepts[0].definition, "Def");
  assert.equal(r.concepts[0].subject, DEFAULT_SUBJECT);
});
test("addConcept rejects empty fields", () => {
  assert.ok(addConcept([], "", "x").error);
  assert.ok(addConcept([], "x", "   ").error);
});
test("addConcept rejects too-long fields", () => {
  assert.ok(addConcept([], "a".repeat(81), "x").error);
  assert.ok(addConcept([], "a", "x".repeat(301)).error);
  assert.ok(addConcept([], "a", "x", "s".repeat(31)).error);
});
test("addConcept rejects a duplicate term in the same subject (case-insensitive)", () => {
  const list = [mk("1", "a", "S")];
  assert.ok(addConcept(list, "t1", "other", "S").error);
  assert.ok(addConcept(list, " T1 ", "other", "s").error);
});
test("the same term is allowed in a different subject", () => {
  const list = [mk("1", "a", "S")];
  const r = addConcept(list, "T1", "other", "Other subject");
  assert.equal(r.error, null);
  assert.equal(r.concepts.length, 2);
});
test("deleteConcept removes only that id", () => {
  const list = [mk("1", "a"), mk("2", "b")];
  assert.deepEqual(deleteConcept(list, "1").map((c) => c.id), ["2"]);
});
test("sanitizeConcepts drops broken entries", () => {
  assert.equal(sanitizeConcepts("nope"), null);
  assert.equal(sanitizeConcepts([mk("1", "a"), { id: 5 }, null]).length, 1);
});
test("sanitizeConcepts gives old data (no subject) the default subject", () => {
  const old = [{ id: "x", term: "Old", definition: "from before subjects" }];
  assert.equal(sanitizeConcepts(old)[0].subject, DEFAULT_SUBJECT);
});

console.log("subjects");
test("listSubjects counts concepts per subject", () => {
  const list = [mkIn("1", "a", "B"), mkIn("2", "b", "A"), mkIn("3", "c", "B")];
  assert.deepEqual(listSubjects(list), [{ name: "A", count: 1 }, { name: "B", count: 2 }]);
});
test("filterBySubject picks one subject or all", () => {
  const list = [mkIn("1", "a", "A"), mkIn("2", "b", "B"), mkIn("3", "c", "A")];
  assert.deepEqual(filterBySubject(list, "A").map((c) => c.id), ["1", "3"]);
  assert.equal(filterBySubject(list, ALL_SUBJECTS).length, 3);
  assert.equal(filterBySubject(list, "nope").length, 0);
});
test("resolveSubject reuses the existing spelling and defaults when empty", () => {
  const list = [mkIn("1", "a", "Biology")];
  assert.equal(resolveSubject(list, " biology "), "Biology");
  assert.equal(resolveSubject(list, "Chemistry"), "Chemistry");
  assert.equal(resolveSubject(list, "   "), DEFAULT_SUBJECT);
});
test("isDuplicate looks only inside the same subject", () => {
  const list = [mkIn("1", "Mitosis", "Bio")];
  assert.equal(isDuplicate(list, "mitosis", "bio"), true);
  assert.equal(isDuplicate(list, "mitosis", "History"), false);
});
test("addMany adds rows to one subject and skips duplicates", () => {
  const list = [mkIn("1", "a", "S")];
  const r = addMany(list, [{ term: "A", definition: "x" }, { term: "b", definition: "y" }, { term: "c", definition: "z" }], "S");
  assert.equal(r.added, 2);
  assert.equal(r.concepts.length, 3);
  assert.equal(new Set(r.concepts.map((c) => c.id)).size, 3);
});
test("groupBySubject: groups sorted by name, concepts keep their order, counts match", () => {
  const list = [mkIn("1", "a", "B"), mkIn("2", "b", "A"), mkIn("3", "c", "B")];
  const groups = groupBySubject(list);
  assert.deepEqual(groups.map((g) => g.name), ["A", "B"]);
  assert.deepEqual(groups[1].concepts.map((c) => c.id), ["1", "3"]);
  assert.equal(groups.reduce((n, g) => n + g.concepts.length, 0), list.length);
  assert.deepEqual(groupBySubject([]), []);
});
test("visibleGroups: all subjects as groups for 전체, a single group for one subject", () => {
  const list = [mkIn("1", "a", "A"), mkIn("2", "b", "B"), mkIn("3", "c", "A")];
  assert.equal(visibleGroups(list, ALL_SUBJECTS).length, 2);
  const only = visibleGroups(list, "A");
  assert.equal(only.length, 1);
  assert.deepEqual(only[0].concepts.map((c) => c.id), ["1", "3"]);
  assert.deepEqual(visibleGroups(list, "nope"), []);
});
test("EDGE CASE: a saved filter whose subject no longer exists falls back to 전체", () => {
  const list = [mkIn("1", "a", "A")];
  assert.equal(normalizeFilter(list, "A"), "A");
  assert.equal(normalizeFilter(list, "Deleted subject"), ALL_SUBJECTS);
  assert.equal(normalizeFilter(list, ALL_SUBJECTS), ALL_SUBJECTS);
  assert.equal(normalizeFilter([], "A"), ALL_SUBJECTS);
});
test("EDGE CASE: a subject with fewer than 4 concepts blocks the quiz, another subject still works", () => {
  const list = [
    ...["a", "b", "c"].map((t, i) => mk("x" + i, "def-" + t, "Small")),
    ...["a", "b", "c", "d"].map((t, i) => mk("y" + i, "other-" + t, "Big")),
  ];
  const small = canStartQuiz(filterBySubject(list, "Small"), "Small");
  assert.equal(small.ok, false);
  assert.match(small.message, /'Small' 과목에는 3개/);
  assert.equal(canStartQuiz(filterBySubject(list, "Big"), "Big").ok, true);
  assert.equal(canStartQuiz(filterBySubject(list, ALL_SUBJECTS)).ok, true);
});
test("wrong options only come from the chosen subject's concepts", () => {
  const bio = ["a", "b", "c", "d"].map((t, i) => mk("b" + i, "bio-" + t, "Bio"));
  const hist = ["a", "b", "c", "d"].map((t, i) => mk("h" + i, "hist-" + t, "Hist"));
  const pool = filterBySubject([...bio, ...hist], "Bio");
  for (let seed = 1; seed <= 30; seed++) {
    const { options } = pickOptions(pool[0], pool, seeded(seed));
    assert.ok(options.every((o) => o.startsWith("bio-")));
  }
});

console.log("quiz start rules");
test("EDGE CASE: fewer than 4 concepts blocks the quiz", () => {
  const r = canStartQuiz([mk("1", "a"), mk("2", "b"), mk("3", "c")]);
  assert.equal(r.ok, false);
  assert.match(r.message, /최소 4개/);
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
console.log("round building: each concept once");
const many = (n) => Array.from({ length: n }, (_, i) => mk("m" + i, "d" + i));
test("10 concepts or fewer: every concept appears exactly once in the main part", () => {
  for (let n = 1; n <= 10; n++) {
    for (let seed = 1; seed <= 20; seed++) {
      const list = many(n);
      const round = buildRound(list, { m0: 5 }, seeded(seed));
      assert.equal(round.length, n);
      assert.deepEqual(round.map((c) => c.id).sort(), list.map((c) => c.id).sort());
    }
  }
});
test("more than 10 concepts: exactly 10 DISTINCT concepts are chosen", () => {
  for (const n of [11, 15, 40]) {
    for (let seed = 1; seed <= 20; seed++) {
      const round = buildRound(many(n), { m0: 5, m1: 2 }, seeded(seed));
      assert.equal(round.length, 10);
      assert.equal(new Set(round.map((c) => c.id)).size, 10);
    }
  }
});
test("the order is shuffled and the original list is not changed", () => {
  const list = many(8);
  const before = list.map((c) => c.id).join();
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++) orders.add(buildRound(list, {}, seeded(seed)).map((c) => c.id).join());
  assert.ok(orders.size > 1);
  assert.equal(list.map((c) => c.id).join(), before);
});
test("with no misses every concept has about the same chance of being included", () => {
  const list = many(20);
  const rng = seeded(99);
  const included = {};
  for (let i = 0; i < 1000; i++) for (const c of buildRound(list, {}, rng)) included[c.id] = (included[c.id] || 0) + 1;
  for (const c of list) assert.ok(included[c.id] > 400 && included[c.id] < 600, c.id + " was included " + included[c.id] + " times");
});
test("EVIDENCE: 1000 rounds from 20 concepts, how often a missed concept is included", () => {
  // 20 concepts, 10 are asked per round. m0-m3 were missed 3 times (weight 4); m4-m19 never missed (weight 1).
  const list = many(20);
  const missed = { m0: 3, m1: 3, m2: 3, m3: 3 };
  const rng = seeded(2024);
  const included = {};
  for (let i = 0; i < 1000; i++) for (const c of buildRound(list, missed, rng)) included[c.id] = (included[c.id] || 0) + 1;
  const avg = (ids) => ids.reduce((sum, id) => sum + (included[id] || 0), 0) / ids.length;
  const missedAvg = avg(["m0", "m1", "m2", "m3"]);
  const neverAvg = avg(list.slice(4).map((c) => c.id));
  console.log("       in 1000 rounds a missed concept was included " + missedAvg.toFixed(0) + " times on average,");
  console.log("       a never-missed concept " + neverAvg.toFixed(0) + " times (" +
    (missedAvg / 10).toFixed(0) + "% vs " + (neverAvg / 10).toFixed(0) + "% of rounds, " +
    (missedAvg / neverAvg).toFixed(2) + "x as often)");
  assert.ok(missedAvg > neverAvg * 1.3, "missed " + missedAvg + " vs never " + neverAvg);
});

console.log("retry part (다시 풀기)");
test("buildRetry: the wrong concepts, once each, in the order they were asked", () => {
  const round = many(5);
  assert.deepEqual(buildRetry(round, ["m3", "m1", "m3"]).map((c) => c.id), ["m1", "m3"]);
});
test("buildRetry: no wrong answers means no retry; unknown ids are ignored", () => {
  assert.equal(buildRetry(many(5), []).length, 0);
  assert.equal(buildRetry(many(5), ["zzz"]).length, 0);
});
test("nextStep: 'next' while questions of this part remain", () => {
  assert.equal(nextStep({ phase: "main", index: 0, length: 5, missedCount: 2 }), "next");
  assert.equal(nextStep({ phase: "retry", index: 0, length: 2, missedCount: 2 }), "next");
});
test("nextStep: after the last main question -> retry if something was missed, otherwise results", () => {
  assert.equal(nextStep({ phase: "main", index: 4, length: 5, missedCount: 1 }), "retry");
  assert.equal(nextStep({ phase: "main", index: 4, length: 5, missedCount: 0 }), "results");
});
test("nextStep: after the last retry question -> results (no second retry)", () => {
  assert.equal(nextStep({ phase: "retry", index: 1, length: 2, missedCount: 2 }), "results");
});
test("full round with 5 concepts and 2 wrong answers: 5 main + 2 retry questions, then results", () => {
  const round = buildRound(many(5), {}, seeded(5));
  const wrongIds = [round[1].id, round[3].id];
  let phase = "main";
  let queue = round;
  let index = 0;
  let asked = 0;
  const missedIds = [];
  for (;;) {
    asked++;
    if (phase === "main" && wrongIds.includes(queue[index].id)) missedIds.push(queue[index].id);
    const step = nextStep({ phase, index, length: queue.length, missedCount: missedIds.length });
    if (step === "next") index++;
    else if (step === "retry") { phase = "retry"; queue = buildRetry(round, missedIds); index = 0; }
    else break;
  }
  assert.equal(asked, 7);
  assert.equal(phase, "retry");
  assert.deepEqual(queue.map((c) => c.id), [round[1].id, round[3].id]);
});
test("a perfect round has no retry part", () => {
  const round = buildRound(many(5), {}, seeded(8));
  let asked = 0;
  for (let index = 0; ; index++) {
    asked++;
    if (nextStep({ phase: "main", index, length: round.length, missedCount: 0 }) === "results") break;
  }
  assert.equal(asked, 5);
});
test("progressLabel clearly marks the retry part", () => {
  assert.equal(progressLabel({ phase: "main", index: 1, length: 5 }), "2 / 5 · 이 개념의 정의는?");
  assert.equal(progressLabel({ phase: "retry", index: 0, length: 2 }), "다시 풀기 1 / 2 · 이 개념의 정의는?");
});

console.log("round length");
test("a round is 10 questions when there are 10 or more concepts", () => {
  const many = Array.from({ length: 15 }, (_, i) => mk(String(i), "d" + i));
  assert.equal(roundLength(many), 10);
  assert.equal(roundLength(many.slice(0, 10)), 10);
});
test("a round is shorter when there are fewer than 10 concepts", () => {
  assert.equal(roundLength(SAMPLE_CONCEPTS.slice(0, 5)), 5);
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

console.log("bulk import: separators");
test("detectSeparator: Tab if any tab is present, otherwise colon", () => {
  assert.equal(detectSeparator("a\tb\nc\td"), "\t");
  assert.equal(detectSeparator("a: b\nc: d"), ":");
  assert.equal(detectSeparator("a: b\nc\td"), "\t");
  assert.equal(detectSeparator("a / b"), ":");
  assert.equal(detectSeparator(""), ":");
});
test("parseLines with ':'", () => {
  const [r] = parseLines("광합성: 빛으로 양분을 만드는 과정", ":");
  assert.equal(r.error, null);
  assert.equal(r.term, "광합성");
  assert.equal(r.definition, "빛으로 양분을 만드는 과정");
});
test("parseLines with '/'", () => {
  const [r] = parseLines("광합성 / 빛으로 양분을 만드는 과정", "/");
  assert.equal(r.error, null);
  assert.equal(r.term, "광합성");
  assert.equal(r.definition, "빛으로 양분을 만드는 과정");
});
test("parseLines with Tab (as copied from a spreadsheet)", () => {
  const [r] = parseLines("광합성\t빛으로 양분을 만드는 과정", "\t");
  assert.equal(r.error, null);
  assert.equal(r.term, "광합성");
  assert.equal(r.definition, "빛으로 양분을 만드는 과정");
});
test("a full-width colon counts as ':'", () => {
  const [r] = parseLines("광합성：빛으로 양분을 만드는 과정", ":");
  assert.equal(r.error, null);
  assert.equal(r.term, "광합성");
});
test("a tab text keeps colons inside the definition", () => {
  const [r] = parseLines("비율\t3:1 이라는 뜻", "\t");
  assert.equal(r.term, "비율");
  assert.equal(r.definition, "3:1 이라는 뜻");
});

console.log("bulk import: splitting and broken lines");
test("splits only at the FIRST separator (the 홍길동 example)", () => {
  const [r] = parseLines("홍길동: 남자, 소설 속 인물: 의적", ":");
  assert.equal(r.term, "홍길동");
  assert.equal(r.definition, "남자, 소설 속 인물: 의적");
});
test("splits only at the first '/' too", () => {
  const [r] = parseLines("및/또는 : a/b/c", "/");
  assert.equal(r.term, "및");
  assert.equal(r.definition, "또는 : a/b/c");
});
test("empty and whitespace-only lines are ignored, line numbers are kept", () => {
  const rows = parseLines("a: 1\n\n   \nb: 2\r\n\r\nc: 3", ":");
  assert.deepEqual(rows.map((r) => r.term), ["a", "b", "c"]);
  assert.deepEqual(rows.map((r) => r.line), [1, 4, 6]);
});
test("empty text gives no rows", () => {
  assert.equal(parseLines("", ":").length, 0);
  assert.equal(parseLines("\n\n", ":").length, 0);
});
test("EDGE CASE: broken lines are marked with an error instead of being dropped", () => {
  const rows = parseLines("구분기호 없음\n: 개념이 비었음\n개념만 있음:\n정상: 정의", ":");
  assert.equal(rows.length, 4);
  assert.ok(rows[0].error.includes("구분 기호"));
  assert.ok(rows[1].error.includes("개념"));
  assert.ok(rows[2].error.includes("정의"));
  assert.equal(rows[3].error, null);
});
test("a line that uses another separator than the chosen one is broken", () => {
  const rows = parseLines("a / b\nc / d", ":");
  assert.ok(rows.every((r) => r.error));
});
test("too-long term or definition is marked as an error", () => {
  const rows = parseLines("a".repeat(81) + ": x\nb: " + "y".repeat(301), ":");
  assert.ok(rows.every((r) => r.error));
});

console.log("bulk import: preview");
test("preview marks ok, duplicate and invalid rows and counts them", () => {
  const existing = [mkIn("1", "Mitosis", "Bio")];
  const rows = parseLines("Meiosis: a\nmitosis: b\nbroken line\nCell: c", ":");
  const p = buildPreview(rows, existing, "Bio");
  assert.deepEqual(p.items.map((i) => i.status), ["ok", "duplicate", "invalid", "ok"]);
  assert.deepEqual(p.counts, { ok: 2, duplicate: 1, invalid: 1 });
  assert.deepEqual(p.toAdd.map((r) => r.term), ["Meiosis", "Cell"]);
});
test("duplicates are checked per subject: same term in another subject is fine", () => {
  const existing = [mkIn("1", "Mitosis", "Bio")];
  const p = buildPreview(parseLines("Mitosis: x", ":"), existing, "History");
  assert.equal(p.items[0].status, "ok");
});
test("a term repeated inside the pasted text is a duplicate (case-insensitive)", () => {
  const p = buildPreview(parseLines("DNA: a\ndna: b\n DNA : c", ":"), [], "Bio");
  assert.deepEqual(p.items.map((i) => i.status), ["ok", "duplicate", "duplicate"]);
  assert.equal(p.toAdd.length, 1);
});
test("an empty subject is previewed against the default subject", () => {
  const existing = [mkIn("1", "A", DEFAULT_SUBJECT)];
  const p = buildPreview(parseLines("a: x", ":"), existing, "  ");
  assert.equal(p.items[0].status, "duplicate");
});
test("preview never adds more than MAX_IMPORT rows", () => {
  const text = Array.from({ length: MAX_IMPORT + 3 }, (_, i) => `t${i}: d${i}`).join("\n");
  const p = buildPreview(parseLines(text, ":"), [], "S");
  assert.equal(p.toAdd.length, MAX_IMPORT);
  assert.equal(p.counts.invalid, 3);
});
test("import end to end: preview rows saved with addMany", () => {
  const existing = [mkIn("1", "기존", "과목")];
  const text = "기존: 이미 있음\n새것1: 정의1\n새것2: 정의: 콜론 포함\n오류";
  const p = buildPreview(parseLines(text, detectSeparator(text)), existing, "과목");
  const r = addMany(existing, p.toAdd, "과목");
  assert.equal(r.added, 2);
  assert.equal(r.concepts.find((c) => c.term === "새것2").definition, "정의: 콜론 포함");
  assert.ok(r.concepts.every((c) => c.subject === "과목"));
});

/* ---------- history.js: round record and recent rounds ---------- */

const runOf = (over = {}) => ({
  score: 85, correct: 8, total: 10, retryCorrect: 1, retryTotal: 2, missedIds: ["a", "b"], ...over,
});
const recOf = (n) => buildRoundRecord({ run: runOf({ score: n }), concepts: [], subject: "S", now: n });

test("round record has the planned fields and turns missed ids into text", () => {
  const concepts = [mkIn("a", "광합성", "생명"), mkIn("b", "리보솜", "생명")];
  const r = buildRoundRecord({ run: runOf(), concepts, subject: "생명", now: 1000 });
  assert.deepEqual(r, {
    finishedAt: 1000, subject: "생명", score: 85, correct: 8, total: 10,
    retryCorrect: 1, retryTotal: 2, missedTerms: ["광합성", "리보솜"],
  });
});
test("round record skips a missed id whose concept no longer exists (no crash)", () => {
  const r = buildRoundRecord({ run: runOf(), concepts: [mkIn("a", "광합성", "생명")], subject: "생명", now: 1 });
  assert.deepEqual(r.missedTerms, ["광합성"]); // "b" no longer exists: skipped, no crash
});
test("round record uses the all-subjects label when no subject is chosen", () => {
  const r = buildRoundRecord({ run: runOf({ missedIds: [] }), concepts: [], subject: null, now: 1 });
  assert.equal(r.subject, ALL_SUBJECTS_LABEL);
  assert.deepEqual(r.missedTerms, []);
});
test("addRecord puts the newest first and keeps only the newest 10", () => {
  let history = [];
  for (let i = 1; i <= 12; i++) history = addRecord(history, recOf(i));
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[0].finishedAt, 12);
  assert.equal(history[9].finishedAt, 3);
});
test("addRecord does not change the list it was given", () => {
  const before = [recOf(1)];
  addRecord(before, recOf(2));
  assert.equal(before.length, 1);
});
test("sanitizeHistory keeps valid records and drops broken ones", () => {
  const good = recOf(5);
  const list = [good, null, "x", { ...good, score: -3 }, { ...good, correct: 11 }, { ...good, finishedAt: "now" },
    { ...good, missedTerms: "no" }];
  assert.deepEqual(sanitizeHistory(list), [good]);
});
test("sanitizeHistory handles non-arrays, filters bad missed terms, caps the length", () => {
  assert.deepEqual(sanitizeHistory(null), []);
  assert.deepEqual(sanitizeHistory({}), []);
  const r = sanitizeHistory([{ ...recOf(1), missedTerms: ["ok", 5, null] }]);
  assert.deepEqual(r[0].missedTerms, ["ok"]);
  const many = Array.from({ length: 15 }, (_, i) => recOf(i));
  assert.equal(sanitizeHistory(many).length, HISTORY_LIMIT);
});

/* ---------- rewards.js: levels, XP, coins, daily cap ---------- */

const at = (day, hour = 12) => new Date(2026, 9, day, hour).getTime(); // Oct <day> 2026, local time
const roundRec = (over = {}) => ({
  finishedAt: 0, subject: "S", score: 100, correct: 10, total: 10, retryCorrect: 0, retryTotal: 0,
  missedTerms: [], ...over,
});

test("xpForLevel follows 50*L*(L-1): 0, 100, 300, 600", () => {
  assert.deepEqual([1, 2, 3, 4].map(xpForLevel), [0, 100, 300, 600]);
});
test("levelForXp is exact at the boundaries", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(299), 2);
  assert.equal(levelForXp(300), 3);
  assert.equal(levelForXp(599), 3);
  assert.equal(levelForXp(600), 4);
});
test("levelForXp agrees with xpForLevel for every level up to 200", () => {
  for (let level = 1; level <= 200; level++) {
    const xp = xpForLevel(level);
    assert.equal(levelForXp(xp), level);
    if (xp > 0) assert.equal(levelForXp(xp - 1), level - 1);
  }
});
test("levelProgress gives the position inside the current level", () => {
  assert.deepEqual(levelProgress(0), { level: 1, into: 0, needed: 100 });
  assert.deepEqual(levelProgress(150), { level: 2, into: 50, needed: 200 });
});
test("rewardsForRound: XP is the score, coins are 1 per correct (+5 if perfect)", () => {
  assert.deepEqual(rewardsForRound(roundRec({ score: 85, correct: 8 })), { xp: 85, coins: 8 });
  assert.deepEqual(rewardsForRound(roundRec({ score: 195, correct: 10 })), { xp: 195, coins: 15 });
});
test("rewardsForRound: the retry part gives nothing", () => {
  const without = rewardsForRound(roundRec({ score: 80, correct: 8, retryTotal: 0 }));
  const withRetry = rewardsForRound(roundRec({ score: 80, correct: 8, retryTotal: 2, retryCorrect: 2 }));
  assert.deepEqual(withRetry, without);
});
test("rewardsForRound: an empty round (0 questions) is not a perfect round", () => {
  assert.deepEqual(rewardsForRound(roundRec({ score: 0, correct: 0, total: 0 })), { xp: 0, coins: 0 });
});
test("applyRound adds XP and coins and reports what was gained", () => {
  const r = applyRound(freshProfile(), roundRec({ score: 85, correct: 8 }), at(29));
  assert.equal(r.profile.xp, 85);
  assert.equal(r.profile.coins, 8);
  assert.deepEqual(r.gained, { xp: 85, coins: 8, capped: false });
  assert.equal(r.profile.daily.date, dateKey(at(29)));
});
test("applyRound does not change the profile it was given", () => {
  const before = freshProfile();
  applyRound(before, roundRec(), at(29));
  assert.deepEqual(before, freshProfile());
});
test("daily cap: XP stops at the cap, the last round is cut off and flagged", () => {
  let profile = freshProfile();
  const big = roundRec({ score: 195, correct: 10 });
  for (let i = 0; i < 3; i++) profile = applyRound(profile, big, at(29)).profile; // 585 XP
  assert.equal(profile.xp, 585);
  const r = applyRound(profile, big, at(29));
  assert.equal(r.gained.xp, DAILY_XP_CAP - 585); // only 15 left
  assert.equal(r.gained.capped, true);
  assert.equal(r.profile.xp, DAILY_XP_CAP);
  assert.equal(r.gained.coins, 15); // coins are not capped
});
test("daily cap: after the cap a round gives 0 XP but still gives coins", () => {
  let profile = applyRound(freshProfile(), roundRec({ score: DAILY_XP_CAP }), at(29)).profile;
  const r = applyRound(profile, roundRec({ score: 100, correct: 10 }), at(29));
  assert.equal(r.gained.xp, 0);
  assert.equal(r.gained.capped, true);
  assert.equal(r.gained.coins, 15);
  assert.equal(xpLeftToday(r.profile, at(29)), 0);
});
test("daily cap: a new calendar day starts the count again", () => {
  let profile = applyRound(freshProfile(), roundRec({ score: DAILY_XP_CAP }), at(29)).profile;
  assert.equal(xpLeftToday(profile, at(29, 23)), 0);
  assert.equal(xpLeftToday(profile, at(30, 0)), DAILY_XP_CAP);
  const r = applyRound(profile, roundRec({ score: 100 }), at(30, 0));
  assert.equal(r.gained.xp, 100);
  assert.equal(r.profile.xp, DAILY_XP_CAP + 100);
});
test("timer bonus gives a small XP and coin amount", () => {
  const r = applyTimerBonus(freshProfile(), at(29));
  assert.equal(r.granted, true);
  assert.deepEqual(r.gained, { xp: TIMER_BONUS_XP, coins: TIMER_BONUS_COINS, capped: false });
  assert.equal(r.profile.xp, TIMER_BONUS_XP);
});
test("timer bonus: only TIMER_BONUS_MAX_PER_DAY times a day, then nothing", () => {
  let profile = freshProfile();
  for (let i = 0; i < TIMER_BONUS_MAX_PER_DAY; i++) {
    const r = applyTimerBonus(profile, at(29));
    assert.equal(r.granted, true);
    profile = r.profile;
  }
  const extra = applyTimerBonus(profile, at(29));
  assert.equal(extra.granted, false);
  assert.deepEqual(extra.gained, { xp: 0, coins: 0, capped: false });
  assert.equal(extra.profile.xp, TIMER_BONUS_XP * TIMER_BONUS_MAX_PER_DAY);
  assert.equal(applyTimerBonus(extra.profile, at(30)).granted, true); // next day works again
});
test("timer bonus counts toward the daily XP cap", () => {
  const profile = applyRound(freshProfile(), roundRec({ score: DAILY_XP_CAP - 2 }), at(29)).profile;
  const r = applyTimerBonus(profile, at(29));
  assert.equal(r.gained.xp, 2);
  assert.equal(r.gained.capped, true);
  assert.equal(r.gained.coins, TIMER_BONUS_COINS);
});
test("leaving the timer running cannot be farmed: 3 bonuses are worth at most 15 XP a day", () => {
  assert.equal(TIMER_BONUS_XP * TIMER_BONUS_MAX_PER_DAY, 15);
});
test("sanitizeProfile repairs missing, negative and non-number data", () => {
  assert.deepEqual(sanitizeProfile(null), freshProfile());
  assert.deepEqual(sanitizeProfile("x"), freshProfile());
  const p = sanitizeProfile({ xp: -5, coins: "9", daily: { date: 5, xp: NaN, timerBonuses: 2.7 }, checkIn: 3 });
  assert.deepEqual(p, { ...freshProfile(), daily: { date: "", xp: 0, timerBonuses: 2 } });
  const saved = {
    xp: 120, coins: 7, daily: { date: "2026-10-29", xp: 50, timerBonuses: 1 },
    checkIn: { last: "2026-10-29", streak: 4 },
  };
  assert.deepEqual(sanitizeProfile(saved), saved);
});

/* ---------- rewards.js: daily check-in and streak ---------- */

test("first check-in: streak 1, 10 XP, 5 + 1 coins", () => {
  const r = applyCheckIn(freshProfile(), at(29));
  assert.equal(r.granted, true);
  assert.deepEqual(r.gained, { xp: CHECKIN_XP, coins: 6, streak: 1 });
  assert.equal(r.profile.xp, 10);
  assert.equal(r.profile.coins, 6);
  assert.deepEqual(r.profile.checkIn, { last: dateKey(at(29)), streak: 1 });
});
test("a second check-in on the same day is refused and changes nothing", () => {
  const first = applyCheckIn(freshProfile(), at(29, 8)).profile;
  assert.equal(canCheckIn(first, at(29, 23)), false);
  const again = applyCheckIn(first, at(29, 23));
  assert.equal(again.granted, false);
  assert.deepEqual(again.profile, first);
  assert.deepEqual(again.gained, { xp: 0, coins: 0, streak: 1 });
});
test("check-in on consecutive days grows the streak and the coin bonus", () => {
  let profile = freshProfile();
  const coins = [];
  for (let day = 1; day <= 3; day++) {
    const r = applyCheckIn(profile, at(day));
    profile = r.profile;
    coins.push(r.gained.coins);
    assert.equal(r.gained.streak, day);
  }
  assert.deepEqual(coins, [6, 7, 8]);
});
test("the streak coin bonus stops at +7", () => {
  let profile = freshProfile();
  let last;
  for (let day = 1; day <= 12; day++) {
    last = applyCheckIn(profile, at(day));
    profile = last.profile;
  }
  assert.equal(last.gained.streak, 12);
  assert.equal(last.gained.coins, 5 + 7);
});
test("missing a day resets the streak to 1", () => {
  const day1 = applyCheckIn(freshProfile(), at(1)).profile;
  const day2 = applyCheckIn(day1, at(2)).profile;
  const after = applyCheckIn(day2, at(4)); // skipped day 3
  assert.equal(after.gained.streak, 1);
  assert.equal(after.profile.checkIn.streak, 1);
});
test("streak works across a month change", () => {
  const oct31 = new Date(2026, 9, 31, 12).getTime();
  const nov1 = new Date(2026, 10, 1, 12).getTime();
  const p = applyCheckIn(freshProfile(), oct31).profile;
  assert.equal(applyCheckIn(p, nov1).gained.streak, 2);
});
test("currentStreak: counts today and yesterday, shows 0 once it is broken or never started", () => {
  assert.equal(currentStreak(freshProfile(), at(29)), 0);
  const p = applyCheckIn(applyCheckIn(freshProfile(), at(1)).profile, at(2)).profile;
  assert.equal(currentStreak(p, at(2)), 2);
  assert.equal(currentStreak(p, at(3)), 2); // not checked in yet today, still alive
  assert.equal(currentStreak(p, at(4)), 0); // broken
});
test("edge case: device clock set backwards cannot check in again", () => {
  const p = applyCheckIn(freshProfile(), at(10)).profile;
  assert.equal(canCheckIn(p, at(9)), false);
  const r = applyCheckIn(p, at(9));
  assert.equal(r.granted, false);
  assert.deepEqual(r.profile, p);
  assert.equal(r.gained.streak, 1); // streak is not lost either
});
test("check-in XP is outside the daily cap and does not use it up", () => {
  const capped = applyRound(freshProfile(), roundRec({ score: DAILY_XP_CAP }), at(29)).profile;
  const r = applyCheckIn(capped, at(29));
  assert.equal(r.gained.xp, CHECKIN_XP); // still granted although today's cap is full
  assert.equal(r.profile.xp, DAILY_XP_CAP + CHECKIN_XP);
  assert.equal(r.profile.daily.xp, DAILY_XP_CAP); // the cap counter is unchanged
  const fresh = applyCheckIn(freshProfile(), at(29)).profile;
  assert.equal(xpLeftToday(fresh, at(29)), DAILY_XP_CAP);
});
test("sanitizeProfile: a broken check-in date means 'never checked in'", () => {
  const p = sanitizeProfile({ checkIn: { last: "yesterday", streak: 9 } });
  assert.equal(canCheckIn(p, at(29)), true);
  assert.equal(currentStreak(p, at(29)), 0);
  assert.equal(applyCheckIn(p, at(29)).gained.streak, 1);
});

/* ---------- rewards.js: automatic check-in, "오늘 N/600 XP" ---------- */

test("finishing a round does today's check-in automatically (once)", () => {
  const r = applyRoundWithCheckIn(freshProfile(), roundRec({ score: 85, correct: 8 }), at(29));
  assert.equal(r.checkIn.granted, true);
  assert.deepEqual(r.checkIn.gained, { xp: CHECKIN_XP, coins: 6, streak: 1 });
  assert.deepEqual(r.gained, { xp: 85, coins: 8, capped: false }); // the round's own reward
  assert.equal(r.profile.xp, 85 + CHECKIN_XP);
  assert.equal(r.profile.coins, 8 + 6);
  assert.deepEqual(r.profile.checkIn, { last: dateKey(at(29)), streak: 1 });
  assert.equal(canCheckIn(r.profile, at(29)), false); // the button would now say "출석 완료"
});
test("a second round the same day gives no second check-in bonus", () => {
  const first = applyRoundWithCheckIn(freshProfile(), roundRec(), at(29, 9));
  const second = applyRoundWithCheckIn(first.profile, roundRec({ score: 50, correct: 5 }), at(29, 20));
  assert.equal(second.checkIn.granted, false);
  assert.equal(second.profile.xp, first.profile.xp + 50);
  assert.equal(second.profile.checkIn.streak, 1);
});
test("button first, then a round: no double check-in bonus", () => {
  const button = applyCheckIn(freshProfile(), at(29, 8));
  const r = applyRoundWithCheckIn(button.profile, roundRec({ score: 100, correct: 10 }), at(29, 9));
  assert.equal(r.checkIn.granted, false);
  assert.equal(r.profile.xp, CHECKIN_XP + 100); // check-in once + the round only
  assert.equal(r.profile.coins, 6 + 15);
});
test("round first, then the button: no double check-in bonus", () => {
  const round = applyRoundWithCheckIn(freshProfile(), roundRec({ score: 100, correct: 10 }), at(29, 8));
  const button = applyCheckIn(round.profile, at(29, 9));
  assert.equal(button.granted, false);
  assert.deepEqual(button.profile, round.profile);
});
test("auto check-in continues the streak on the next day", () => {
  const day1 = applyRoundWithCheckIn(freshProfile(), roundRec(), at(1)).profile;
  const day2 = applyRoundWithCheckIn(day1, roundRec(), at(2));
  assert.equal(day2.checkIn.gained.streak, 2);
  assert.equal(applyRoundWithCheckIn(day2.profile, roundRec(), at(4)).checkIn.gained.streak, 1); // gap
});
test("auto check-in XP stays outside the daily cap, the round XP is still capped", () => {
  const r = applyRoundWithCheckIn(freshProfile(), roundRec({ score: DAILY_XP_CAP + 100 }), at(29));
  assert.equal(r.gained.xp, DAILY_XP_CAP);
  assert.equal(r.gained.capped, true);
  assert.equal(r.profile.xp, DAILY_XP_CAP + CHECKIN_XP);
  assert.equal(xpEarnedToday(r.profile, at(29)), DAILY_XP_CAP);
});
test("finishing a focus timer also checks in, and still limits the timer bonus", () => {
  const r = applyTimerWithCheckIn(freshProfile(), at(29));
  assert.equal(r.checkIn.granted, true);
  assert.equal(r.granted, true);
  assert.equal(r.profile.xp, TIMER_BONUS_XP + CHECKIN_XP);
  let profile = r.profile;
  for (let i = 1; i < TIMER_BONUS_MAX_PER_DAY; i++) profile = applyTimerWithCheckIn(profile, at(29)).profile;
  const extra = applyTimerWithCheckIn(profile, at(29));
  assert.equal(extra.granted, false); // bonus used up
  assert.equal(extra.checkIn.granted, false); // and no second check-in
});
test("edge case: with the clock set backwards a round still pays, but gives no check-in", () => {
  const p = applyCheckIn(freshProfile(), at(10)).profile;
  const r = applyRoundWithCheckIn(p, roundRec({ score: 60, correct: 6 }), at(9));
  assert.equal(r.checkIn.granted, false);
  assert.equal(r.profile.xp, CHECKIN_XP + 60);
});
test("xpEarnedToday counts today's XP only and starts again on a new day", () => {
  assert.equal(xpEarnedToday(freshProfile(), at(29)), 0);
  const p = applyRound(freshProfile(), roundRec({ score: 590 }), at(29)).profile;
  assert.equal(xpEarnedToday(p, at(29, 23)), 590);
  assert.equal(xpEarnedToday(p, at(30, 1)), 0);
  assert.equal(p.xp, 590); // total XP (the level bar) is a separate number
});

/* ---------- timer.js: timestamp-based focus timer ---------- */

const T0 = at(29, 10);
const MIN = 60_000;

test("timer offers 1 (demo), 10, 15 and 25 minutes", () => {
  assert.deepEqual(DURATIONS, [1, 10, 15, 25]);
});
test("startTimer stores the end time (start + minutes) and is not paused", () => {
  assert.deepEqual(startTimer(T0, 25), { minutes: 25, endAt: T0 + 25 * MIN, pausedMs: null });
  assert.equal(isPaused(startTimer(T0, 25)), false);
});
test("remaining time is computed from the clock, not counted", () => {
  const t = startTimer(T0, 10);
  assert.equal(remainingMs(t, T0), 10 * MIN);
  assert.equal(remainingMs(t, T0 + 4 * MIN), 6 * MIN);
  assert.equal(remainingMs(t, T0 + 10 * MIN - 1), 1);
});
test("background throttling: no ticks for 7 minutes, the next read is still exact", () => {
  const t = startTimer(T0, 10);
  assert.equal(remainingMs(t, T0 + 7 * MIN + 123), 3 * MIN - 123);
  assert.equal(isFinished(t, T0 + 7 * MIN), false);
});
test("timer finishes exactly at the end time and stays finished", () => {
  const t = startTimer(T0, 1);
  assert.equal(isFinished(t, T0 + MIN - 1), false);
  assert.equal(isFinished(t, T0 + MIN), true);
  assert.equal(remainingMs(t, T0 + 3 * 3600_000), 0); // opened hours later: 0, never negative
});
test("edge case: clock set backwards does not make the timer longer than it was", () => {
  const t = startTimer(T0, 10);
  assert.equal(remainingMs(t, T0 - 5 * MIN), 10 * MIN);
  assert.equal(isFinished(t, T0 - 5 * MIN), false);
});
test("progress goes from 0 to 1", () => {
  const t = startTimer(T0, 10);
  assert.equal(progress(t, T0), 0);
  assert.equal(progress(t, T0 + 5 * MIN), 0.5);
  assert.equal(progress(t, T0 + 20 * MIN), 1);
});
test("formatRemaining shows MM:SS and rounds up to the next second", () => {
  assert.equal(formatRemaining(25 * MIN), "25:00");
  assert.equal(formatRemaining(61_000), "01:01");
  assert.equal(formatRemaining(59_001), "01:00");
  assert.equal(formatRemaining(1), "00:01");
  assert.equal(formatRemaining(0), "00:00");
});
test("sanitizeTimer keeps a real running timer and rejects broken ones", () => {
  const t = startTimer(T0, 15);
  assert.deepEqual(sanitizeTimer(t), t);
  assert.equal(sanitizeTimer(null), null);
  assert.equal(sanitizeTimer("x"), null);
  assert.equal(sanitizeTimer({ ...t, minutes: 7 }), null); // not an offered length
  assert.equal(sanitizeTimer({ ...t, endAt: "soon" }), null);
  assert.equal(sanitizeTimer({ minutes: 10 }), null);
  assert.equal(sanitizeTimer({ minutes: 10, endAt: null, pausedMs: null }), null);
});

/* ---------- timer.js: pause and resume ---------- */

test("pause freezes the time left", () => {
  const paused = pauseTimer(startTimer(T0, 10), T0 + 4 * MIN);
  assert.equal(isPaused(paused), true);
  assert.deepEqual(paused, { minutes: 10, endAt: null, pausedMs: 6 * MIN });
  assert.equal(remainingMs(paused, T0 + 4 * MIN), 6 * MIN);
  assert.equal(remainingMs(paused, T0 + 3 * 3600_000), 6 * MIN); // hours later: still 6 minutes
});
test("a paused timer never finishes, however long the page stays closed", () => {
  const paused = pauseTimer(startTimer(T0, 1), T0 + 1000);
  assert.equal(isFinished(paused, T0 + 1000), false);
  assert.equal(isFinished(paused, T0 + 24 * 3600_000), false);
  assert.equal(remainingMs(paused, T0 + 24 * 3600_000), MIN - 1000); // frozen
  assert.ok(Math.abs(progress(paused, T0 + 24 * 3600_000) - 1000 / MIN) < 1e-9); // bar does not move
});
test("resume keeps the remaining time: a new end time counted from now", () => {
  const paused = pauseTimer(startTimer(T0, 10), T0 + 4 * MIN); // 6 minutes left
  const later = T0 + 30 * MIN; // paused for 26 minutes
  const resumed = resumeTimer(paused, later);
  assert.equal(isPaused(resumed), false);
  assert.equal(resumed.endAt, later + 6 * MIN);
  assert.equal(remainingMs(resumed, later), 6 * MIN);
  assert.equal(isFinished(resumed, later + 6 * MIN - 1), false);
  assert.equal(isFinished(resumed, later + 6 * MIN), true);
});
test("time spent paused is not counted: pause, resume, pause again", () => {
  let t = startTimer(T0, 10);
  t = pauseTimer(t, T0 + 2 * MIN); // 8 left
  t = resumeTimer(t, T0 + 50 * MIN);
  t = pauseTimer(t, T0 + 53 * MIN); // ran 3 more minutes -> 5 left
  assert.equal(remainingMs(t, T0 + 99 * MIN), 5 * MIN);
});
test("pause/resume on the wrong state change nothing", () => {
  const running = startTimer(T0, 10);
  const paused = pauseTimer(running, T0 + MIN);
  assert.equal(resumeTimer(running, T0 + MIN), running); // not paused: nothing to resume
  assert.equal(pauseTimer(paused, T0 + 2 * MIN), paused); // pausing twice keeps the first frozen time
  const over = startTimer(T0, 1);
  assert.equal(pauseTimer(over, T0 + MIN), over); // too late to pause a finished timer
  assert.equal(isFinished(pauseTimer(over, T0 + MIN), T0 + MIN), true);
});
test("pause does not mutate the timer it was given", () => {
  const t = startTimer(T0, 10);
  pauseTimer(t, T0 + MIN);
  assert.deepEqual(t, { minutes: 10, endAt: T0 + 10 * MIN, pausedMs: null });
});
test("reload while paused: saved JSON comes back as the same paused timer", () => {
  const paused = pauseTimer(startTimer(T0, 25), T0 + 10 * MIN); // 15 min left
  const restored = sanitizeTimer(JSON.parse(JSON.stringify(paused)));
  assert.deepEqual(restored, paused);
  assert.equal(isPaused(restored), true);
  assert.equal(remainingMs(restored, T0 + 5 * 3600_000), 15 * MIN);
  assert.equal(isFinished(restored, T0 + 5 * 3600_000), false);
});
test("sanitizeTimer rejects broken paused timers", () => {
  const ok = { minutes: 10, endAt: null, pausedMs: 5 * MIN };
  assert.deepEqual(sanitizeTimer(ok), ok);
  assert.equal(sanitizeTimer({ ...ok, pausedMs: 0 }), null); // would be "finished" while paused
  assert.equal(sanitizeTimer({ ...ok, pausedMs: -5 }), null);
  assert.equal(sanitizeTimer({ ...ok, pausedMs: 11 * MIN }), null); // more than the whole timer
  assert.equal(sanitizeTimer({ ...ok, pausedMs: 1.5 }), null);
  assert.equal(sanitizeTimer({ ...ok, pausedMs: "5" }), null);
  assert.equal(sanitizeTimer({ ...ok, endAt: T0 }), null); // both set: ambiguous
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
