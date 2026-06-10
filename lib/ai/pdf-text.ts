import { PDFParse } from "pdf-parse";

// A PDF is treated as having a usable text layer only when extraction yields at
// least this many characters — below this it's almost certainly a scanned image
// and should go through the vision model instead.
const MIN_TEXT_LAYER_CHARS = 100;

/**
 * Extract a PDF's embedded text layer locally (no model call). Returns the text
 * when the PDF has a real digital text layer, or null for scanned/image-only
 * PDFs (and on any parse failure — callers fall back to the vision path).
 */
export async function extractPdfTextLayer(buffer: Buffer): Promise<string | null> {
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    // pdf-parse appends "-- N of M --" page separators even for text-less pages;
    // strip them so the threshold measures real document content, not footers.
    const text = (result.text ?? "").replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();
    return text.length >= MIN_TEXT_LAYER_CHARS ? text : null;
  } catch {
    return null;
  } finally {
    await parser?.destroy().catch(() => {});
  }
}
