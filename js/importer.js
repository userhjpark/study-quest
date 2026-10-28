// Bulk import parsing: pure functions, no DOM and no storage.
// Flow: text -> parseLines (one row per non-empty line) -> buildPreview (ok / duplicate / invalid).
// buildPreview takes plain rows, so another source (e.g. a PDF) can feed it later.

import { MAX_TERM, MAX_DEFINITION, keyOf, normalizeSubject } from "./concepts.js";

export const SEPARATORS = [":", "/", "\t"];
export const MAX_IMPORT = 500; // concepts per import, keeps the preview and storage small

// Text copied from Excel or Google Sheets contains tabs. Otherwise assume ":".
export function detectSeparator(text) {
  return text.includes("\t") ? "\t" : ":";
}

// Position of the FIRST separator in a line, or -1. A full-width "：" (easy to type by
// accident on a Korean keyboard) counts as ":".
function findSeparator(line, separator) {
  if (separator === ":") return line.search(/[:：]/);
  return line.indexOf(separator);
}

// One row per non-empty line. Empty lines are ignored; `line` keeps the original
// line number (1-based) so error messages can point at it.
// Each row is { line, raw, term, definition, error } where error is null when the line parsed.
export function parseLines(text, separator) {
  const rows = [];
  String(text).split(/\r\n|\r|\n/).forEach((raw, i) => {
    if (raw.trim() === "") return;
    const row = { line: i + 1, raw, term: "", definition: "", error: null };
    const at = findSeparator(raw, separator);
    if (at === -1) {
      row.error = "구분 기호가 없어요";
    } else {
      // Split only at the first separator; the rest stays in the definition untouched.
      row.term = raw.slice(0, at).trim();
      row.definition = raw.slice(at + 1).trim();
      if (!row.term) row.error = "개념이 비어 있어요";
      else if (!row.definition) row.error = "정의가 비어 있어요";
      else if (row.term.length > MAX_TERM) row.error = `개념이 ${MAX_TERM}자를 넘어요`;
      else if (row.definition.length > MAX_DEFINITION) row.error = `정의가 ${MAX_DEFINITION}자를 넘어요`;
    }
    rows.push(row);
  });
  return rows;
}

// Decides what happens to each row when saving into `subject`:
//   "ok"        will be added
//   "duplicate" skipped (already in that subject, or repeated earlier in the pasted text)
//   "invalid"   skipped (could not be parsed, or over the per-import limit)
// Returns { items, toAdd, counts } where items are the rows plus { status, reason }.
export function buildPreview(rows, existing, subject) {
  const subjectKey = keyOf(normalizeSubject(subject));
  const saved = new Set(
    existing.filter((c) => keyOf(c.subject) === subjectKey).map((c) => keyOf(c.term))
  );
  const pasted = new Set();
  const items = [];
  const toAdd = [];
  const counts = { ok: 0, duplicate: 0, invalid: 0 };

  for (const row of rows) {
    let status = "ok";
    let reason = "";
    if (row.error) {
      status = "invalid";
      reason = row.error;
    } else if (saved.has(keyOf(row.term))) {
      status = "duplicate";
      reason = "이미 있는 개념이에요";
    } else if (pasted.has(keyOf(row.term))) {
      status = "duplicate";
      reason = "위에 같은 개념이 있어요";
    } else if (counts.ok >= MAX_IMPORT) {
      status = "invalid";
      reason = `한 번에 ${MAX_IMPORT}개까지만 추가할 수 있어요`;
    } else {
      pasted.add(keyOf(row.term));
      toAdd.push({ term: row.term, definition: row.definition });
    }
    counts[status] += 1;
    items.push({ ...row, status, reason });
  }
  return { items, toAdd, counts };
}
