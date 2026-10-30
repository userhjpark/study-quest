// Reads the text of a PDF in the browser with pdf.js (third-party, loaded from a CDN only when the
// user picks a file, so the app itself needs no download and still works offline without it).
// The rules and the line rebuilding are in pdf-text.js (pure, tested); this file is the browser part.
//
// Two pdf.js versions are tried in this order (never committed to this repo):
//   1. 6.4.299, "legacy" build, ES module: the version tested on desktop Chrome.
//   2. 3.11.174, "legacy" build, plain script: only a fallback for browsers where the first one fails
//      (iPhone Safari was reported failing on Oct 30). It is older and less tested with Korean PDFs,
//      so the status line tells the user when it was used.

import { PDF_MESSAGES, checkPdfFile, checkPageCount, pagesToText, looksScanned } from "./pdf-text.js";

export const PDFJS_VERSION = "6.4.299";
export const PDFJS_FALLBACK_VERSION = "3.11.174";
const MODERN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/`;
const CLASSIC_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_FALLBACK_VERSION}/legacy/build/`;

// An error whose message is already the Korean text for the user.
//   final  = true when another pdf.js version cannot help (scan, too long, password, damaged file)
//   detail = technical text for the small grey line under the message (step, error name, message)
export class PdfError extends Error {
  constructor(message, { final = false, detail = "" } = {}) {
    super(message);
    this.final = final;
    this.detail = detail;
  }
}

// Every failure is logged with the step it happened in, because the user only sees a short message.
function logFailure(engine, step, err) {
  console.error(`[PDF] ${engine} failed at step "${step}":`, err && err.name, err && err.message, err);
}

function describe(engine, step, err) {
  const name = (err && err.name) || "Error";
  const message = String((err && err.message) || err).slice(0, 160);
  return `${engine} · 단계 ${step} · ${name}: ${message}`;
}

/* ---------- Loading the two versions ---------- */

const loading = {}; // engine name -> promise of the library

function loadModern() {
  return import(/* a dynamic import: only runs when a PDF is chosen */ MODERN_BASE + "pdf.min.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = MODERN_BASE + "pdf.worker.min.mjs";
    return lib;
  });
}

function loadClassic() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CLASSIC_BASE + "pdf.min.js";
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return reject(new Error("pdfjsLib is missing after loading the script"));
      lib.GlobalWorkerOptions.workerSrc = CLASSIC_BASE + "pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("could not load " + script.src));
    document.head.append(script);
  });
}

const ENGINES = [
  { name: `pdf.js ${PDFJS_VERSION}`, load: loadModern, fallback: false },
  { name: `pdf.js ${PDFJS_FALLBACK_VERSION}`, load: loadClassic, fallback: true },
];

function getLibrary(engine) {
  if (!loading[engine.name]) {
    loading[engine.name] = engine.load().catch((err) => {
      delete loading[engine.name]; // allow another try after the connection is back
      throw err;
    });
  }
  return loading[engine.name];
}

/* ---------- Reading with one version ---------- */

// Errors after which another pdf.js version cannot help: the file itself is the problem.
function fileProblem(err) {
  const name = err && err.name;
  if (name === "PasswordException") return PDF_MESSAGES.password;
  if (name === "InvalidPDFException" || name === "MissingPDFException") return PDF_MESSAGES.broken;
  return null;
}

async function readWith(engine, file, onProgress) {
  let lib;
  try {
    lib = await getLibrary(engine);
  } catch (err) {
    logFailure(engine.name, "1 loading pdf.js", err);
    throw new PdfError(PDF_MESSAGES.offline, { detail: describe(engine.name, "1 (불러오기)", err) });
  }

  let task = null;
  let doc;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    task = lib.getDocument({ data });
    doc = await task.promise; // this is also where the worker is started
  } catch (err) {
    logFailure(engine.name, "2 opening the file / starting the worker", err);
    const problem = fileProblem(err);
    throw new PdfError(problem || PDF_MESSAGES.engine, {
      final: problem !== null, detail: describe(engine.name, "2 (파일 열기/작업자)", err),
    });
  }

  try {
    const pageError = checkPageCount(doc.numPages);
    if (pageError) throw new PdfError(pageError, { final: true });

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
      logFailure(engine.name, step, err);
      throw new PdfError(fileProblem(err) || PDF_MESSAGES.engine, {
        final: fileProblem(err) !== null, detail: describe(engine.name, `3 (${step.slice(2)})`, err),
      });
    }
    const text = pagesToText(pages);
    if (looksScanned(text, doc.numPages)) throw new PdfError(PDF_MESSAGES.scanned, { final: true });
    return { text, pages: doc.numPages, engine: engine.name, usedFallback: engine.fallback };
  } catch (err) {
    if (err instanceof PdfError) throw err;
    logFailure(engine.name, "4 after reading (unexpected)", err);
    throw new PdfError(PDF_MESSAGES.engine, { detail: describe(engine.name, "4 (읽은 뒤)", err) });
  } finally {
    // The loading task frees the document and the worker (pdf.js 6 has no doc.destroy()).
    // A cleanup problem must never turn a successful read into an error.
    try {
      await task.destroy();
    } catch (err) {
      console.warn("[PDF] cleanup failed (ignored):", err);
    }
  }
}

// Short browser description for the technical line (the user cannot open a console on a phone).
function browserInfo() {
  return typeof navigator === "undefined" ? "" : ` | ${String(navigator.userAgent).slice(0, 120)}`;
}

// Returns { text, pages, engine, usedFallback }. Throws PdfError with a user-readable message for
// every expected problem. `onProgress(done, total)` is called after each page.
export async function readPdfText(file, onProgress = () => {}) {
  const fileError = checkPdfFile(file);
  if (fileError) throw new PdfError(fileError, { final: true });

  const details = [];
  let last = null;
  for (const engine of ENGINES) {
    try {
      return await readWith(engine, file, onProgress);
    } catch (err) {
      if (!(err instanceof PdfError)) throw err;
      last = err;
      details.push(err.detail);
      if (err.final) break; // the file is the problem, a second version would say the same
    }
  }
  const technical = details.filter(Boolean).join("  →  ");
  throw new PdfError(last.message, { final: last.final, detail: technical ? technical + browserInfo() : "" });
}
