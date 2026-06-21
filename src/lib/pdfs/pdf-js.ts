/** Lazy-load pdf.js and configure the worker (client-only). */
let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("pdf.js can only load in the browser");
  }
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

export type PdfDocumentProxy = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadPdfJs>>["getDocument"]>
>["promise"] extends Promise<infer T>
  ? T
  : never;
