/**
 * Extraction of financial data from a forwarded agent email.
 *
 * The prompt and the response parsing are exported separately from the model
 * call so both can be tested without contacting a provider. That split exists
 * because of a real defect: the prompt used to instruct the model to store the
 * NET amount disbursed to the owner in `amount`, explicitly "NOT the gross rent
 * income figure", while lib/tax/rental-income.ts#actualRentForFy sums that
 * column and reports it as GROSS rent. Every email-ingested payment understated
 * assessable rental income by the whole of the agent's fees and outgoings, and
 * nothing in the codebase asserted otherwise.
 */
import { generateText } from "ai";
import { z } from "zod";
import { extractionModel } from "@/lib/ai/openai-client";

/**
 * A field the model may omit, state as null, or get wrong.
 *
 * `.catch(null)` degrades a single unreadable field to "not stated" instead of
 * failing the whole extraction — a statement with one odd fee line is still
 * worth ingesting. Critically it does NOT coerce: a model returning
 * "$4,400.00" yields null rather than a number silently stripped of its comma,
 * because a quietly mangled figure ends up in a tax return.
 */
const numberField = z.number().finite().nullable().catch(null);
const stringField = z.string().nullable().catch(null);

const statementSchema = z.object({
  type: z.enum(["rental_payment", "expense", "unknown"]).catch("unknown"),
  /**
   * For a rental statement this is GROSS rent — the assessable figure. What the
   * agent actually disbursed is `netReceived`.
   */
  amount: numberField,
  gstAmount: numberField,
  paymentDate: stringField,
  periodStart: stringField,
  periodEnd: stringField,
  supplier: stringField,
  abn: stringField,
  category: stringField,
  propertyAddress: stringField,
  confidence: z.number().min(0).max(1).catch(0),

  // ── Agent statement breakdown (migration 063) ─────────────────────────────
  // Itemised because the management fee is a percentage of rent while letting
  // and lease fees are one-off, and because sundry charges feed a different ATO
  // line from commission.
  managementFees: numberField,
  lettingFees: numberField,
  leaseFees: numberField,
  sundryFees: numberField,
  /**
   * Costs the agent paid to a third party. Recorded so the statement
   * reconciles to the bank; NEVER a deduction here — those costs deduct via
   * their own invoice, the only path that classifies them correctly.
   */
  otherOutgoings: numberField,
  /**
   * Assessable income that is NOT rent — a tenant reimbursement for water
   * usage, a retained letting fee, an insurance payout for lost rent. Reported
   * on the ATO's "Other rental-related income" line.
   *
   * Deliberately not folded into `amount`: gross rent is cross-checked against
   * the tenancy accrual (weekly_rent x weeks), which a water recovery would
   * make diverge for a legitimate reason.
   */
  otherIncome: numberField,
  otherIncomeNote: stringField,
  /** What the agent disbursed: (amount + otherIncome) − fees − otherOutgoings. */
  netReceived: numberField,
});

export type ParsedStatement = z.infer<typeof statementSchema>;

const UNKNOWN_STATEMENT: ParsedStatement = {
  type: "unknown",
  amount: null,
  gstAmount: null,
  paymentDate: null,
  periodStart: null,
  periodEnd: null,
  supplier: null,
  abn: null,
  category: null,
  propertyAddress: null,
  confidence: 0,
  managementFees: null,
  lettingFees: null,
  leaseFees: null,
  sundryFees: null,
  otherOutgoings: null,
  otherIncome: null,
  otherIncomeNote: null,
  netReceived: null,
};

/** Today as `yyyy-mm-dd`, injected so the prompt is a pure function of its inputs. */
function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function buildStatementPrompt(
  sender: string,
  subject: string,
  body: string,
  today: string = todayIso(),
): string {
  return `You are extracting financial data from a real estate agent email. Return ONLY valid JSON, no other text.

Email sender: ${sender}
Email subject: ${subject}
Email body:
${body.slice(0, 4000)}

The email may include OCR'd text from an attached invoice or bill (e.g. a water bill or repair invoice) delimited by "--- Attachment: ... ---". The real figures usually live in the attachment, so prefer those.

Extract the following and return as JSON:
{
  "type": "rental_payment" | "expense" | "unknown",
  "amount": number or null (see the rules below — for rent this is GROSS rent, for an expense it is the total payable, in AUD, no currency symbols),
  "gstAmount": number or null (GST component if shown separately),
  "paymentDate": "YYYY-MM-DD" or null (invoice/service date for expenses, payment date for rent),
  "periodStart": "YYYY-MM-DD" or null (rental period covered),
  "periodEnd": "YYYY-MM-DD" or null,
  "supplier": string or null (vendor/payee name for expenses, managing agent for a rental statement),
  "abn": string or null (supplier ABN, digits only, spaces removed),
  "category": string or null (one of: "water", "council_rates", "insurance", "repairs_maintenance", "strata_fees", "land_tax", "other"),
  "propertyAddress": string or null (street address mentioned),
  "confidence": number between 0 and 1,
  "managementFees": number or null (agent management fee / commission charged this statement),
  "lettingFees": number or null (one-off letting or re-letting fee),
  "leaseFees": number or null (lease preparation or renewal fee),
  "sundryFees": number or null (bank charges, postage, admin sundries charged by the agent),
  "otherOutgoings": number or null (total the agent paid to THIRD PARTIES on the owner's behalf — tradespeople, suppliers, councils),
  "otherIncome": number or null (money in that is NOT rent — see the rules),
  "otherIncomeNote": string or null (what that other income was for, e.g. "Water usage recovered from tenant"),
  "netReceived": number or null (the amount actually disbursed to the owner)
}

Rules:
- type is "rental_payment" if the email is about rent received or a rental statement
- type is "expense" if the email is about an invoice, bill, or property operating expense (water, council rates, repairs, strata, insurance)
- type is "unknown" if unclear
- For rental_payment (owner/landlord statements): "amount" is the GROSS RENT collected from the tenant — the "Money In" or rent total, BEFORE any fees or outgoings are deducted. Gross rent is the owner's assessable income; the agent's deductions are claimed separately. Sum every rent line if several are listed.
- For rental_payment: "netReceived" is the amount the agent paid out to the owner — look for "You Received", "Withdrawal by EFT", or "Net to owner". This is NOT the same as "amount" and must never be reported as it.
- For rental_payment: report each agent fee in its own field, GST-INCLUSIVE, exactly as it appears on the statement. Do not merge them into one figure.
- For rental_payment: put payments the agent made to third parties (tradespeople, suppliers) in "otherOutgoings", NOT in any fee field. These are the owner's expenses but are evidenced by the supplier's own invoice.
- For rental_payment: "otherIncome" is money in that is NOT rent — most often an amount the tenant reimbursed the owner for, such as water usage, but also a retained letting fee or an insurance payout for lost rent. Put it here, NOT in "amount". "amount" is rent only, because it is compared against the tenancy's weekly rent.
- For rental_payment: the figures should satisfy (amount + otherIncome) − (all fees) − otherOutgoings = netReceived. If they do not, still report each figure exactly as read rather than adjusting any of them to force a balance.
- For rental_payment (owner/landlord statements): paymentDate is the statement date or EFT disbursement date (the date the agent paid the owner), NOT the dates the tenant paid rent
- For dates, today is ${today}`;
}

/**
 * Validate a model response into a `ParsedStatement`.
 *
 * Returns an unknown result with zero confidence rather than throwing: a
 * malformed response means "could not read this", which the caller stages for
 * human review. Confidence 0 is what marks it as untrusted.
 */
export function parseStatementResponse(text: string): ParsedStatement {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return UNKNOWN_STATEMENT;

  let candidate: unknown;
  try {
    candidate = JSON.parse(jsonMatch[0]);
  } catch {
    return UNKNOWN_STATEMENT;
  }

  const result = statementSchema.safeParse(candidate);
  return result.success ? result.data : UNKNOWN_STATEMENT;
}

export async function parseEmailStatement(
  sender: string,
  subject: string,
  body: string,
): Promise<ParsedStatement> {
  const { text } = await generateText({
    model: extractionModel,
    prompt: buildStatementPrompt(sender, subject, body),
  });
  return parseStatementResponse(text);
}
