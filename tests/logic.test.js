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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
