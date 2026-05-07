import { generateText } from "ai";
import { extractionModel } from "./openai-client";

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

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const base64 = buffer.toString("base64");

  const { text } = await generateText({
    model: extractionModel,
    messages: [
      {
        role: "user",
        content: [
          mimeType === "application/pdf"
            ? { type: "file" as const, data: base64, mediaType: "application/pdf" as const }
            : { type: "image" as const, image: `data:${mimeType};base64,${base64}` },
          {
            type: "text",
            text: "Extract all text from this invoice verbatim. Preserve line structure. Include all dates, amounts, descriptions, ABN numbers, and supplier details. Output only the raw extracted text, no commentary.",
          },
        ],
      },
    ],
  });

  return text.trim();
}
