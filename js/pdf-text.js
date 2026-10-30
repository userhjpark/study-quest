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
export function rebuildLines(items) {
  const lines = [];
  let line = "";
  let lineY = null;
  let prevEnd = null;
  const flush = () => {
    const text = line.replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
    line = "";
    lineY = null;
    prevEnd = null;
  };

  for (const item of items) {
    if (item === null || typeof item !== "object" || typeof item.str !== "string") continue;
    const [x, y] = Array.isArray(item.transform) ? [item.transform[4], item.transform[5]] : [0, 0];
    const height = Number.isFinite(item.height) && item.height > 0 ? item.height : 10;
    if (lineY !== null && Math.abs(y - lineY) > height * 0.5) flush();

    if (line !== "" && item.str !== "") {
      const gap = prevEnd === null ? 0 : x - prevEnd;
      const spaced = /\s$/.test(line) || /^\s/.test(item.str);
      if (!spaced && gap > height * 0.15) line += " ";
    }
    line += item.str;
    if (item.str !== "") {
      if (lineY === null) lineY = y;
      prevEnd = x + (Number.isFinite(item.width) ? item.width : 0);
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

// Text of the whole file: `pages` is a list with one list of pdf.js pieces per page.
export function pagesToText(pages) {
  return pages.flatMap((items) => rebuildLines(items)).join("\n");
}

// Puts the PDF text below what is already in the box, with a blank line between.
export function appendText(existing, added) {
  const before = String(existing).replace(/\s+$/, "");
  return before === "" ? added : `${before}\n\n${added}`;
}
