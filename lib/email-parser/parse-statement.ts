import { generateText } from "ai";
import { extractionModel } from "@/lib/ai/openai-client";

export type ParsedStatement = {
  type: "rental_payment" | "expense" | "unknown";
  amount: number | null;
  gstAmount: number | null;
  paymentDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  supplier: string | null;
  abn: string | null;
  category: string | null;
  propertyAddress: string | null;
  confidence: number;
};

export async function parseEmailStatement(
  sender: string,
  subject: string,
  body: string,
): Promise<ParsedStatement> {
  const prompt = `You are extracting financial data from a real estate agent email. Return ONLY valid JSON, no other text.

Email sender: ${sender}
Email subject: ${subject}
Email body:
${body.slice(0, 4000)}

The email may include OCR'd text from an attached invoice or bill (e.g. a water bill or repair invoice) delimited by "--- Attachment: ... ---". The real figures usually live in the attachment, so prefer those.

Extract the following and return as JSON:
{
  "type": "rental_payment" | "expense" | "unknown",
  "amount": number or null (total payable in AUD, no currency symbols),
  "gstAmount": number or null (GST component if shown separately),
  "paymentDate": "YYYY-MM-DD" or null (invoice/service date for expenses, payment date for rent),
  "periodStart": "YYYY-MM-DD" or null (rental period covered),
  "periodEnd": "YYYY-MM-DD" or null,
  "supplier": string or null (vendor/payee name for expenses),
  "abn": string or null (supplier ABN, digits only, spaces removed),
  "category": string or null (one of: "water", "council_rates", "insurance", "repairs_maintenance", "strata_fees", "land_tax", "other"),
  "propertyAddress": string or null (street address mentioned),
  "confidence": number between 0 and 1
}

Rules:
- type is "rental_payment" if the email is about rent received or a rental statement
- type is "expense" if the email is about an invoice, bill, or property operating expense (water, council rates, repairs, strata, insurance)
- type is "unknown" if unclear
- For rental_payment (owner/landlord statements): amount is the net amount disbursed to the owner — look for "You Received", "Withdrawal by EFT", or "Net to owner", NOT the gross rent income figure
- For rental_payment (owner/landlord statements): paymentDate is the statement date or EFT disbursement date (the date the agent paid the owner), NOT the dates the tenant paid rent
- For dates, today is ${new Date().toISOString().split("T")[0]}`;

  const { text } = await generateText({
    model: extractionModel,
    prompt,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]) as ParsedStatement;
  } catch {
    return {
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
    };
  }
}
