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

function loadLibrary() {
  if (!libraryPromise) {
    libraryPromise = import(/* a dynamic import: only runs when a PDF is chosen */ BASE + "pdf.min.mjs")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.mjs";
        return lib;
      })
      .catch(() => {
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
  let doc;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    doc = await lib.getDocument({ data }).promise;
  } catch (err) {
    throw new PdfError(err && err.name === "PasswordException" ? PDF_MESSAGES.password : PDF_MESSAGES.broken);
  }

  try {
    const pageError = checkPageCount(doc.numPages);
    if (pageError) throw new PdfError(pageError);

    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items);
      onProgress(i, doc.numPages);
    }
    const text = pagesToText(pages);
    if (looksScanned(text, doc.numPages)) throw new PdfError(PDF_MESSAGES.scanned);
    return { text, pages: doc.numPages };
  } catch (err) {
    if (err instanceof PdfError) throw err;
    throw new PdfError(PDF_MESSAGES.broken);
  } finally {
    doc.destroy();
  }
}
