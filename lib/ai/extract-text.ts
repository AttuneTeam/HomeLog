import { generateText } from "ai";
import { classificationModel } from "./openai-client";
// import pdfParse from "pdf-parse";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export function mimeTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

/**
 * Extracts text from a file buffer.
 * - PDF: uses pdf-parse (pure JS, no native deps)
 * - Images: uses Claude vision for high-quality OCR
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    // Imported this way to avoid pdf-parse's self-test file read at module load time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // const pdfParse = await import("pdf-parse");
    // const result = await pdfParse(buffer);
    const { PDFParse } = require("pdf-parse") as {
      PDFParse: new (options: { data: Buffer }) => {
        getText: () => Promise<{ text?: string; total?: number }>;
      };
    };
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    console.log(pdfData.text);
    return pdfData.text?.trim() || "";
  }

  // Image: use Claude vision
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const { text } = await generateText({
    model: classificationModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: dataUrl,
          },
          {
            type: "text",
            text: "Extract all text from this invoice image verbatim. Preserve line structure. Include all dates, amounts, descriptions, ABN numbers, and supplier details. Output only the raw extracted text, no commentary.",
          },
        ],
      },
    ],
  });

  return text.trim();
}
