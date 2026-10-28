// Concept notes and subjects: pure functions, no DOM and no storage.
// Every function returns a new list instead of changing the old one.

export const DEFAULT_SUBJECT = "미분류";
export const ALL_SUBJECTS = "all"; // quiz picker value meaning "every subject"
export const MAX_TERM = 80;
export const MAX_DEFINITION = 300;
export const MAX_SUBJECT = 30;

export const SAMPLE_CONCEPTS = [
  { id: "s1", subject: "생명과학", term: "광합성", definition: "식물이 빛 에너지로 물과 이산화탄소를 포도당과 산소로 바꾸는 과정" },
  { id: "s2", subject: "생명과학", term: "미토콘드리아", definition: "세포 안에서 영양소를 분해해 에너지(ATP)를 만드는 세포 소기관" },
  { id: "s3", subject: "생명과학", term: "리보솜", definition: "유전 정보에 따라 단백질을 합성하는 세포 소기관" },
  { id: "s4", subject: "생명과학", term: "DNA", definition: "생물의 유전 정보를 저장하고 있는 이중 나선 구조의 물질" },
  { id: "s5", subject: "생명과학", term: "효소", definition: "생물체 안에서 화학 반응의 속도를 빠르게 하는 단백질 촉매" },
  { id: "s6", subject: "한국사", term: "훈민정음", definition: "1443년 세종대왕이 창제하고 1446년에 반포한 우리나라 글자" },
  { id: "s7", subject: "한국사", term: "임진왜란", definition: "1592년 일본이 조선을 침략하여 일어난 7년간의 전쟁" },
  { id: "s8", subject: "한국사", term: "3·1 운동", definition: "1919년 일제의 식민 지배에 맞서 전국에서 일어난 독립 만세 운동" },
  { id: "s9", subject: "한국사", term: "대동법", definition: "특산물 대신 쌀, 베, 동전으로 세금을 내게 한 조선 후기의 세금 제도" },
  { id: "s10", subject: "한국사", term: "거북선", definition: "이순신 장군이 임진왜란 때 활용한, 덮개를 씌운 조선 수군의 전투선" },
];

// Lower-cased, trimmed text used to compare terms and subjects ("DNA" equals "dna ").
export function keyOf(text) {
  return String(text).trim().toLowerCase();
}

// Trim and collapse inner spaces; an empty subject becomes "미분류".
export function normalizeSubject(subject) {
  const s = String(subject ?? "").trim().replace(/\s+/g, " ");
  return s || DEFAULT_SUBJECT;
}

// If the typed subject matches an existing one ignoring case ("bio" vs "Bio"),
// reuse the existing spelling so one subject never splits in two.
export function resolveSubject(concepts, subject) {
  const wanted = normalizeSubject(subject);
  const match = concepts.find((c) => keyOf(c.subject) === keyOf(wanted));
  return match ? match.subject : wanted;
}

// Duplicate = same term inside the same subject (ignoring case and outer spaces).
export function isDuplicate(concepts, term, subject) {
  const t = keyOf(term);
  const s = keyOf(normalizeSubject(subject));
  return concepts.some((c) => keyOf(c.term) === t && keyOf(c.subject) === s);
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return "c" + Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}

export function addConcept(concepts, term, definition, subject = "") {
  const t = String(term).trim();
  const d = String(definition).trim();
  const sub = resolveSubject(concepts, subject);
  if (!t || !d) {
    return { concepts, error: "개념과 정의를 모두 입력해 주세요." };
  }
  if (t.length > MAX_TERM) {
    return { concepts, error: `개념은 ${MAX_TERM}자까지 입력할 수 있어요.` };
  }
  if (d.length > MAX_DEFINITION) {
    return { concepts, error: `정의는 ${MAX_DEFINITION}자까지 입력할 수 있어요.` };
  }
  if (sub.length > MAX_SUBJECT) {
    return { concepts, error: `과목 이름은 ${MAX_SUBJECT}자까지 입력할 수 있어요.` };
  }
  if (isDuplicate(concepts, t, sub)) {
    return { concepts, error: "이 과목에 이미 같은 개념이 있어요." };
  }
  return { concepts: [...concepts, { id: makeId(), subject: sub, term: t, definition: d }], error: null };
}

// Adds many rows ({term, definition}) to one subject. Rows are expected to be
// already checked by importer.buildPreview; duplicates are still skipped here as a safety net.
export function addMany(concepts, rows, subject) {
  const sub = resolveSubject(concepts, subject);
  let next = concepts;
  let added = 0;
  for (const row of rows) {
    if (isDuplicate(next, row.term, sub)) continue;
    next = [...next, { id: makeId(), subject: sub, term: row.term, definition: row.definition }];
    added += 1;
  }
  return { concepts: next, added };
}

export function deleteConcept(concepts, id) {
  return concepts.filter((c) => c.id !== id);
}

// Stored data could be edited, damaged, or from before subjects existed.
// Keep well-formed entries and give old ones the default subject.
export function sanitizeConcepts(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((c) => c && typeof c.id === "string" && typeof c.term === "string" && typeof c.definition === "string")
    .map((c) => ({
      id: c.id,
      term: c.term,
      definition: c.definition,
      subject: typeof c.subject === "string" ? normalizeSubject(c.subject) : DEFAULT_SUBJECT,
    }));
}

// [{ name, count }], sorted by name.
export function listSubjects(concepts) {
  const counts = new Map();
  for (const c of concepts) counts.set(c.subject, (counts.get(c.subject) || 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function filterBySubject(concepts, subject) {
  if (subject === ALL_SUBJECTS) return concepts;
  return concepts.filter((c) => c.subject === subject);
}
