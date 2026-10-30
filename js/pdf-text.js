// PDF import rules: pure functions, no DOM, no pdf.js. The browser part is in pdf-reader.js.
// Flow: file checks -> text pieces from pdf.js -> rebuildLines -> text -> the bulk import preview.

export const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const PDF_MAX_PAGES = 50;

const MIN_CHARS_TOTAL = 20; // fewer letters than this in the whole file = nothing readable
const MIN_CHARS_PER_PAGE = 5; // ...or hardly any per page on average

// Messages shown in red under the PDF button (Korean UI).
export const PDF_MESSAGES = {
  notPdf: "PDF 파일만 불러올 수 있어요.",
  empty: "빈 파일이에요.",
  tooBig: `파일이 너무 커요. ${PDF_MAX_BYTES / 1024 / 1024}MB 이하의 PDF를 골라 주세요.`,
  tooManyPages: (pages) => `페이지가 너무 많아요 (${pages}쪽). ${PDF_MAX_PAGES}쪽 이하의 PDF를 골라 주세요.`,
  scanned: "글자를 읽을 수 없는 PDF예요. 스캔본이나 사진으로 된 PDF는 지원하지 않아요.",
  password: "비밀번호가 걸린 PDF는 읽을 수 없어요.",
  broken: "PDF를 읽지 못했어요. 파일이 깨졌을 수 있어요.",
  library: "PDF 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.",
  engine: "이 브라우저에서는 PDF 읽기가 안 될 수 있어요 (특히 아이폰 Safari). 컴퓨터에서 해 보거나, 내용을 직접 붙여 넣어 주세요.",
  offline: "PDF 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요. (아이폰 Safari에서는 PDF 읽기가 안 될 수도 있어요.)",
};

// Checks the chosen file before reading it. Returns an error text, or null when it is fine.
export function checkPdfFile({ name, size, type }) {
  const looksPdf = type === "application/pdf" || /\.pdf$/i.test(String(name));
  if (!looksPdf) return PDF_MESSAGES.notPdf;
  if (!(size > 0)) return PDF_MESSAGES.empty;
  if (size > PDF_MAX_BYTES) return PDF_MESSAGES.tooBig;
  return null;
}

export function checkPageCount(pages) {
  return pages > PDF_MAX_PAGES ? PDF_MESSAGES.tooManyPages(pages) : null;
}

// True when the text is (almost) empty for this many pages: a scan or a picture-only PDF.
export function looksScanned(text, pages) {
  const chars = String(text).replace(/\s/g, "").length;
  return chars < MIN_CHARS_TOTAL || chars / Math.max(1, pages) < MIN_CHARS_PER_PAGE;
}

// pdf.js gives text as small pieces: { str, transform: [a, b, c, d, x, y], width, height, hasEOL }.
// They arrive in reading order of the page, so the order is kept (sorting by x would mix up
// columns). A new line starts when the vertical position changes by more than half a letter
// height, or when pdf.js marks an end of line. A space is added between two pieces on one line
// when there is a visible gap and neither side already has one.
// Returns one object per line with its position, which joinWrappedLines needs:
//   { text, x0, x1, y, height, spaceBefore, spaceAfter }
// (x0/x1 = left/right end, spaceBefore/After = the raw line started/ended with a space).
export function rebuildLineInfos(items) {
  const lines = [];
  let cur = null;
  const flush = () => {
    if (cur) {
      const text = cur.raw.replace(/\s+/g, " ").trim();
      if (text) {
        lines.push({
          text, x0: cur.x0, x1: cur.x1, y: cur.y, height: cur.height,
          spaceBefore: /^\s/.test(cur.raw), spaceAfter: /\s$/.test(cur.raw),
        });
      }
    }
    cur = null;
  };

  for (const item of items) {
    if (item === null || typeof item !== "object" || typeof item.str !== "string") continue;
    const [x, y] = Array.isArray(item.transform) ? [item.transform[4], item.transform[5]] : [0, 0];
    const height = Number.isFinite(item.height) && item.height > 0 ? item.height : 10;
    if (cur && Math.abs(y - cur.y) > height * 0.5) flush();

    if (item.str !== "") {
      if (!cur) cur = { raw: "", x0: x, x1: x, y, height, prevEnd: null };
      if (cur.raw !== "") {
        const gap = cur.prevEnd === null ? 0 : x - cur.prevEnd;
        const spaced = /\s$/.test(cur.raw) || /^\s/.test(item.str);
        if (!spaced && gap > height * 0.15) cur.raw += " ";
      }
      cur.raw += item.str;
      const end = x + (Number.isFinite(item.width) ? item.width : 0);
      cur.prevEnd = end;
      cur.x0 = Math.min(cur.x0, x);
      cur.x1 = Math.max(cur.x1, end);
      if (Number.isFinite(item.height) && item.height > 0) cur.height = Math.max(cur.height, item.height);
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

/* ---------- Wrapped lines ---------- */

// A line with this (":" or the full-width "：") is a "concept: definition" line. The PDF import
// fills the paste box, where ":" is the default separator.
const HAS_SEPARATOR = /[:：]/;
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const LATIN = /[A-Za-z0-9]/;

// Slack (in points) from the right edge within which a line still counts as "full width".
function wrapSlack(left, right, height) {
  return Math.max(height * 5, (right - left) * 0.12);
}

// Where the text area ends on this page: the right end of the long lines. The top 10% of right
// ends are skipped so one right-aligned date or page number does not stretch the text area.
function rightEdge(lines) {
  const ends = lines.map((l) => l.x1).sort((a, b) => b - a);
  return ends[Math.floor(ends.length * 0.1)];
}

// Joins two halves of a wrapped line. Korean is often broken inside a word ("시" / "스템"), so
// between two Hangul letters nothing is added. A space is added when the line break had one, or
// when a Latin word/number meets another letter ("name" / "system", "서버" / "DNS").
function joinParts(prev, next) {
  if (prev.spaceAfter || next.spaceBefore) return `${prev.text} ${next.text}`;
  const a = prev.text.slice(-1);
  const b = next.text.charAt(0);
  const bothHangul = HANGUL.test(a) && HANGUL.test(b);
  const eitherLatin = LATIN.test(a) || LATIN.test(b);
  return bothHangul || !eitherLatin ? prev.text + next.text : `${prev.text} ${next.text}`;
}

// PDF lines that are only the wrapped rest of the line above are joined to it. A line is joined
// when ALL of these are true (otherwise it stays separate, so a really broken line still shows up
// red in the preview):
//   - it has no separator itself;
//   - the line above has a separator (it is a concept line) and reached close to the right edge
//     of the text area, so it was wrapped and not just short;
//   - it follows closely (the vertical gap is at most 2 letter heights, no paragraph break).
// A joined line counts as the new line above, so a definition that wraps twice works too.
export function joinWrappedLines(lines) {
  if (lines.length < 2) return lines.map((l) => l.text);
  const left = Math.min(...lines.map((l) => l.x0));
  const right = rightEdge(lines);
  const out = [];
  let prev = null; // the line above, with the position of its LAST physical line
  for (const line of lines) {
    const close = prev && prev.y - line.y > 0 && prev.y - line.y <= prev.height * 2;
    const wrapped = prev && prev.x1 >= right - wrapSlack(left, right, prev.height);
    if (prev && close && wrapped && HAS_SEPARATOR.test(prev.text) && !HAS_SEPARATOR.test(line.text)) {
      prev = { ...line, text: joinParts(prev, line), spaceBefore: prev.spaceBefore };
      out[out.length - 1] = prev.text;
    } else {
      prev = line;
      out.push(line.text);
    }
  }
  return out;
}

// Text lines of one page, with wrapped lines joined.
export function rebuildLines(items) {
  return joinWrappedLines(rebuildLineInfos(items));
}

// Text of the whole file: `pages` is a list with one list of pdf.js pieces per page. Lines are
// only joined within a page.
export function pagesToText(pages) {
  return pages.flatMap((items) => rebuildLines(items)).join("\n");
}

// Puts the PDF text below what is already in the box, with a blank line between.
export function appendText(existing, added) {
  const before = String(existing).replace(/\s+$/, "");
  return before === "" ? added : `${before}\n\n${added}`;
}
