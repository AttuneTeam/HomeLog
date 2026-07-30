import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./openai-client";

/**
 * Structured fields from a managing agent's rental statement.
 *
 * Every amount is nullable because agent statement layouts vary widely and a
 * missing figure must surface as "not found" for a human to fill in, never as a
 * fabricated value.
 *
 * The distinction the schema exists to enforce is gross_rent vs net_received.
 * Statements lead with the disbursed amount — it is the number the owner cares
 * about day to day — but gross rent is the assessable income and the agent's
 * deductions are claimed separately. Conflating them understated assessable
 * income on every email-ingested payment before this track; see
 * lib/email-parser/parse-statement.ts.
 */
export const rentalStatementSchema = z.object({
  gross_rent: z
    .number()
    .nullable()
    .describe(
      "TOTAL RENT collected from the tenant over this statement, in dollars, BEFORE any fees or outgoings are deducted. This is the 'Money In' rent total, not the amount paid out to the owner. If several rent lines are listed, sum them. Exclude anything that is not rent, such as a water usage recovery. Null if no rent total can be determined.",
    ),
  management_fees: z
    .number()
    .nullable()
    .describe(
      "Agent management fee or commission charged on this statement, GST-inclusive exactly as printed. Null if not charged.",
    ),
  letting_fees: z
    .number()
    .nullable()
    .describe(
      "One-off letting or re-letting fee, GST-inclusive as printed. This is a separate charge from the recurring management fee. Null if not charged.",
    ),
  lease_fees: z
    .number()
    .nullable()
    .describe(
      "Lease preparation or lease renewal fee, GST-inclusive as printed. Null if not charged.",
    ),
  sundry_fees: z
    .number()
    .nullable()
    .describe(
      "Bank charges, postage and administrative sundries charged by the AGENT, GST-inclusive as printed. Often shown under a separate 'Account Transactions' section. Null if not charged.",
    ),
  other_outgoings: z
    .number()
    .nullable()
    .describe(
      "Total the agent paid to THIRD PARTIES on the owner's behalf — tradespeople, suppliers, councils, water authorities. Do NOT include any of the agent's own fees above. Sum them if there are several. Null if the agent paid no third party on this statement.",
    ),
  other_income: z
    .number()
    .nullable()
    .describe(
      "Money in that is NOT rent — most often an amount the tenant reimbursed for water usage, but also a retained letting fee or an insurance payout for lost rent. Must NOT be included in gross_rent. Null if there is none.",
    ),
  other_income_note: z
    .string()
    .nullable()
    .describe(
      "What the other_income was for, as printed, e.g. 'Water usage'. Null if there is no other income.",
    ),
  net_received: z
    .number()
    .nullable()
    .describe(
      "Amount actually disbursed to the owner — 'You Received', 'Withdrawal by EFT', or 'Net to owner'. Null if not shown.",
    ),
  agent_name: z
    .string()
    .nullable()
    .describe("Managing agency name as printed on the statement"),
  statement_ref: z
    .string()
    .nullable()
    .describe(
      "Statement number and/or account reference, as printed, e.g. 'Statement #1 - OWN10905'. Keep it exactly as shown.",
    ),
  period_start: z
    .string()
    .nullable()
    .describe(
      "Start of the rental period this statement covers, YYYY-MM-DD. This is the tenancy period, not the statement issue date. Null if not determinable.",
    ),
  period_end: z
    .string()
    .nullable()
    .describe("End of the rental period covered, YYYY-MM-DD"),
  statement_date: z
    .string()
    .nullable()
    .describe(
      "Date the statement was issued or the owner was paid, YYYY-MM-DD. NOT the dates the tenant paid rent.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How confident you are that gross_rent and the fee breakdown are correct. Use 0.9+ only when clearly labelled totals were read directly. Use 0.5 or below when figures were inferred, summed from parts, or the document was hard to read.",
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Anything the reviewer should check — a balance brought forward, an unfamiliar fee label, figures that do not add up, more than one property on the statement. Null if nothing of note.",
    ),
});

export type RentalStatementFields = z.infer<typeof rentalStatementSchema>;

const INSTRUCTION = [
  "Extract the structured fields from this managing agent's rental statement.",
  "The critical distinction is gross_rent versus net_received.",
  "gross_rent is the rent collected from the tenant BEFORE deductions — the 'Money In' rent total.",
  "net_received is what the agent paid out to the owner — 'You Received' or 'Withdrawal by EFT'.",
  "These are different numbers and must never be reported as the same value.",
  "Report each of the agent's own fees in its own field, GST-inclusive as printed, and do not merge them.",
  "Money the agent paid to a tradesperson or supplier goes in other_outgoings, never in a fee field.",
  "A tenant reimbursement such as water usage goes in other_income, never in gross_rent.",
  "The figures should satisfy (gross_rent + other_income) − (all fees) − other_outgoings = net_received.",
  "If they do not, report each figure exactly as read and say so in notes. Never adjust a figure to force a balance.",
  "Return null for any field you cannot determine. Never guess a number.",
].join(" ");

/**
 * Extract rental statement fields from a document.
 *
 * The document goes to the model as-is — a PDF as a native file part, anything
 * else as an image — mirroring extractLoanStatementFields, which is the path
 * already working in production.
 *
 * There is deliberately no local text-extraction step. Parsing the PDF's text
 * layer first would save tokens on the dense tables agents use, but it would
 * make this a second upload path with a server-side PDF parse, and `pdf-parse`
 * resolves to a DOM-dependent build under Vercel's bundler, taking the whole
 * route down with a module-load error before any handler runs.
 */
export async function extractRentalStatementFields(
  buffer: Buffer,
  mimeType: string,
): Promise<RentalStatementFields> {
  const content = [
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
    schema: rentalStatementSchema,
    messages: [{ role: "user", content }],
  });

  return object;
}
