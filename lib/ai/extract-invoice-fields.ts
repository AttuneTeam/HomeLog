import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./openai-client";

// Matches the public.expense_category enum (001_initial_schema.sql).
export const EXPENSE_CATEGORIES = [
  "labour",
  "materials",
  "permits",
  "professional_fees",
  "appliances",
  "fixtures",
  "other",
] as const;

export const invoiceFieldsSchema = z.object({
  amount: z.number().nullable().describe("Total amount payable on the invoice"),
  gst_amount: z.number().nullable().describe("GST component of the total, if shown separately"),
  expense_date: z.string().nullable().describe("Invoice or service date in YYYY-MM-DD format"),
  description: z.string().nullable().describe("Brief description of what was purchased or the work performed"),
  supplier: z.string().nullable().describe("Supplier or contractor business name"),
  abn: z.string().nullable().describe("Supplier ABN, digits only with spaces removed"),
  contractor_phone: z.string().nullable().describe("Supplier phone number as printed on the invoice"),
  contractor_email: z.string().nullable().describe("Supplier email address as printed on the invoice"),
  contractor_website: z.string().nullable().describe("Supplier website URL as printed on the invoice"),
  contractor_address: z.string().nullable().describe("Supplier street address as printed on the invoice header"),
  contractor_suburb: z.string().nullable().describe("Suburb of the supplier address"),
  contractor_state: z.string().nullable().describe("State abbreviation of the supplier address (e.g. NSW, VIC)"),
  contractor_postcode: z.string().nullable().describe("Postcode of the supplier address"),
  category: z
    .enum(EXPENSE_CATEGORIES)
    .describe(
      "Best-fit expense category. Use 'labour' for tradesperson work, 'materials' for building supplies, 'permits' for council/permit fees, 'professional_fees' for architects/surveyors/accountants, 'appliances' for whitegoods/appliances, 'fixtures' for fixed fittings (taps, lights, cabinetry). Use 'other' only when none clearly fit.",
    ),
  trade: z
    .string()
    .nullable()
    .describe("Trade hint for the supplier, e.g. 'plumbing', 'electrical', 'carpentry'. Null if not a trade."),
  raw_text: z
    .string()
    .nullable()
    .describe(
      "All text on the invoice transcribed verbatim, preserving line structure — every date, amount, line-item description, ABN, and supplier detail. The complete document text, in addition to the structured fields above.",
    ),
});

export type InvoiceFields = z.infer<typeof invoiceFieldsSchema>;

const INSTRUCTION =
  "Extract the structured expense fields from this invoice, classify it into the best-fit category, AND transcribe the full invoice text verbatim into raw_text. Return null for any field not found.";

/**
 * Extract structured invoice fields from a document.
 *
 * When `opts.rawText` is supplied (a PDF that already has a usable text layer),
 * a text-only model call is used instead of the vision path — the same
 * structured output, at a fraction of the token cost. Otherwise the document is
 * sent to the vision model as an image (or native PDF for application/pdf).
 */
export async function extractInvoiceFields(
  buffer: Buffer,
  mimeType: string,
  opts?: { rawText?: string },
): Promise<InvoiceFields> {
  const textLayer = opts?.rawText?.trim();

  const content = textLayer
    ? [
        {
          type: "text" as const,
          text: `${INSTRUCTION}\n\nInvoice text:\n${textLayer}`,
        },
      ]
    : [
        mimeType === "application/pdf"
          ? { type: "file" as const, data: buffer.toString("base64"), mediaType: "application/pdf" as const }
          : { type: "image" as const, image: `data:${mimeType};base64,${buffer.toString("base64")}` },
        { type: "text" as const, text: INSTRUCTION },
      ];

  const { object } = await generateObject({
    model: extractionModel,
    output: "object",
    schema: invoiceFieldsSchema,
    messages: [{ role: "user", content }],
  });

  return object;
}
