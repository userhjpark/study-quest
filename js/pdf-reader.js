// Reads the text of a PDF in the browser with pdf.js (third-party, loaded from a CDN only when the
// user picks a file, so the app itself needs no download and still works offline without it).
// The rules and the line rebuilding are in pdf-text.js (pure, tested); this file is the browser part.

import { PDF_MESSAGES, checkPdfFile, checkPageCount, pagesToText, looksScanned } from "./pdf-text.js";

// Pinned version of the "legacy" build (also runs on older phones). Never committed to this repo.
export const PDFJS_VERSION = "6.4.299";
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/`;

// An error whose message is already the Korean text for the user.
export class PdfError extends Error {}

let libraryPromise = null;

// Every failure is logged with the step it happened in, because the user only sees a short message.
function logFailure(step, err) {
  console.error(`[PDF] failed at step "${step}":`, err && err.name, err && err.message, err);
}

function loadLibrary() {
  if (!libraryPromise) {
    libraryPromise = import(/* a dynamic import: only runs when a PDF is chosen */ BASE + "pdf.min.mjs")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.mjs";
        return lib;
      })
      .catch((err) => {
        logFailure(`1 loading pdf.js (${BASE}pdf.min.mjs)`, err);
        libraryPromise = null; // allow another try after the connection is back
        throw new PdfError(PDF_MESSAGES.library);
      });
  }
  return libraryPromise;
}

// Returns { text, pages }. Throws PdfError with a user-readable message for every expected problem.
// `onProgress(done, total)` is called after each page.
export async function readPdfText(file, onProgress = () => {}) {
  const fileError = checkPdfFile(file);
  if (fileError) throw new PdfError(fileError);

  const lib = await loadLibrary();
  let task = null;
  let doc;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    task = lib.getDocument({ data });
    doc = await task.promise; // this is also where the worker (pdf.worker.min.mjs) is started
  } catch (err) {
    logFailure(`2 opening the file / starting the worker (${BASE}pdf.worker.min.mjs)`, err);
    throw new PdfError(err && err.name === "PasswordException" ? PDF_MESSAGES.password : PDF_MESSAGES.broken);
  }

  try {
    const pageError = checkPageCount(doc.numPages);
    if (pageError) throw new PdfError(pageError);

    const pages = [];
    let step = "3 reading pages";
    try {
      for (let i = 1; i <= doc.numPages; i += 1) {
        step = `3 reading page ${i}`;
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items);
        onProgress(i, doc.numPages);
      }
    } catch (err) {
      logFailure(step, err);
      throw new PdfError(PDF_MESSAGES.broken);
    }
    const text = pagesToText(pages);
    if (looksScanned(text, doc.numPages)) throw new PdfError(PDF_MESSAGES.scanned);
    return { text, pages: doc.numPages };
  } catch (err) {
    if (err instanceof PdfError) throw err;
    logFailure("4 after reading (unexpected)", err);
    throw new PdfError(PDF_MESSAGES.broken);
  } finally {
    // pdf.js 6 has no doc.destroy(); the loading task frees the document and the worker.
    // A cleanup problem must never turn a successful read into an error.
    try {
      await task.destroy();
    } catch (err) {
      console.warn("[PDF] cleanup failed (ignored):", err);
    }
  }
}
