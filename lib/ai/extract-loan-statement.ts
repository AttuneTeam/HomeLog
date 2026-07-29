import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./openai-client";

/**
 * Structured fields from an annual loan statement.
 *
 * Every field is nullable because lender statements vary widely and a missing
 * field must surface as "not found" for the user to fill in, never as a
 * fabricated value. `interest_paid` in particular is the claimable figure: a
 * guess here would end up in a tax return.
 */
export const loanStatementSchema = z.object({
  interest_paid: z
    .number()
    .nullable()
    .describe(
      "Total INTEREST charged over the statement period, in dollars. This is interest only — do NOT include principal repayments, redraws, or the closing balance. If the statement shows interest by month, sum them. Null if no interest total can be determined.",
    ),
  fees_charged: z
    .number()
    .nullable()
    .describe(
      "Total loan account fees over the period, if shown separately from interest. Null if not shown.",
    ),
  lender: z
    .string()
    .nullable()
    .describe("Lender or bank name as printed on the statement"),
  account_ref: z
    .string()
    .nullable()
    .describe(
      "Loan account number or identifier, as printed. Keep any masking (e.g. ****1234) exactly as shown.",
    ),
  period_start: z
    .string()
    .nullable()
    .describe("Statement period start date in YYYY-MM-DD format"),
  period_end: z
    .string()
    .nullable()
    .describe("Statement period end date in YYYY-MM-DD format"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How confident you are that interest_paid is correct. Use 0.9+ only when a clearly labelled interest total was read directly. Use 0.5 or below when it was inferred, summed from parts, or the document was hard to read.",
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Anything the reviewer should check — ambiguous labelling, multiple accounts on one statement, a period that does not align to the financial year. Null if nothing of note.",
    ),
});

export type LoanStatementFields = z.infer<typeof loanStatementSchema>;

const INSTRUCTION = [
  "Extract the structured fields from this annual loan statement.",
  "The critical field is interest_paid: the total INTEREST charged over the period.",
  "Do not include principal repayments, redraw amounts, offset balances, or the loan balance.",
  "If interest is broken down by month or by sub-account, sum it and say so in notes.",
  "Return null for any field you cannot determine. Never guess a number.",
].join(" ");

/**
 * Extract loan statement fields from a document.
 *
 * Mirrors extractInvoiceFields: when a usable PDF text layer is supplied a
 * text-only call is made, which is both cheaper and more accurate on the dense
 * tabular layouts lenders use. Otherwise the document goes to the vision path.
 */
export async function extractLoanStatementFields(
  buffer: Buffer,
  mimeType: string,
  opts?: { rawText?: string },
): Promise<LoanStatementFields> {
  const textLayer = opts?.rawText?.trim();

  const content = textLayer
    ? [
        {
          type: "text" as const,
          text: `${INSTRUCTION}\n\nStatement text:\n${textLayer}`,
        },
      ]
    : [
        mimeType === "application/pdf"
          ? {
              type: "file" as const,
              data: buffer.toString("base64"),
              mediaType: "application/pdf" as const,
            }
          : {
              type: "image" as const,
              image: `data:${mimeType};base64,${buffer.toString("base64")}`,
            },
        { type: "text" as const, text: INSTRUCTION },
      ];

  const { object } = await generateObject({
    model: extractionModel,
    output: "object",
    schema: loanStatementSchema,
    messages: [{ role: "user", content }],
  });

  return object;
}
