/**
 * Regression tests for the agent-statement parser.
 *
 * These exist because of a real defect: the prompt instructed the model to put
 * the NET amount disbursed to the owner into `amount`, explicitly "NOT the
 * gross rent income figure", while lib/tax/rental-income.ts#actualRentForFy
 * sums that same column and reports it as GROSS rent. Every email-ingested
 * payment therefore understated assessable income by the whole of the agent's
 * fees and outgoings.
 *
 * The model is never called here. The prompt and the response parsing are pure
 * and are tested directly; fixtures stand in for what the model returns.
 */
import { describe, expect, it } from "vitest";
import {
  buildStatementPrompt,
  parseStatementResponse,
} from "@/lib/email-parser/parse-statement";

/**
 * Rich & Oliva statement OWN10905, 28 Nov 2025, 56 Forbes St Croydon Park.
 * The document that exposed the defect.
 *
 *   Gross rent (2 x $2,200)     4,400.00   <- assessable income
 *   Management fees               242.00
 *   Letting fees                1,210.00
 *   Lease fee                      33.00
 *   Bank & sundries                 8.80
 *   Supa Blinds (third party)   2,146.00   <- deducts via its own invoice
 *   You Received                  760.20   <- what hit the bank
 */
const OWN10905_BODY = `
Tax Invoice — Account OWN10905
Statement #1, 28 Nov 2025

Money In $4,400.00
Money Out $3,639.80
You Received $760.20

56 Forbes St, Croydon Park NSW 2133
Rented for $1,100.00 per week
Rent paid to 5/12/2025 (moved in 22/11/2025), paid from deposit  $2,200.00
Rent paid to 19/12/2025 (previously paid to 5/12/2025)           $2,200.00

Supa Blinds - Supa Blinds *   $2,146.00
Lease Fee *                      $33.00
Letting Fees *                $1,210.00
Management Fees *               $242.00
Bank & Sundries *                 $8.80

Withdrawal by EFT to owner Raul Felix Carrizo & Aleksandra Matic  $760.20
`;

/** What a correct extraction of the statement above looks like. */
const OWN10905_RESPONSE = JSON.stringify({
  type: "rental_payment",
  amount: 4400,
  gstAmount: null,
  paymentDate: "2025-11-28",
  periodStart: "2025-11-22",
  periodEnd: "2025-12-19",
  supplier: "Rich & Oliva Pty Ltd",
  abn: "52003845047",
  category: null,
  propertyAddress: "56 Forbes St, Croydon Park NSW 2133",
  confidence: 0.95,
  managementFees: 242,
  lettingFees: 1210,
  leaseFees: 33,
  sundryFees: 8.8,
  otherOutgoings: 2146,
  netReceived: 760.2,
});

describe("buildStatementPrompt — the gross-versus-net contract", () => {
  const prompt = buildStatementPrompt(
    "accounts@richandoliva.com.au",
    "Statement #1 - OWN10905",
    OWN10905_BODY,
    "2026-07-30",
  );

  it("does NOT carry the inverted instruction that caused the defect", () => {
    // The exact wording that told the model to store net in `amount`.
    expect(prompt).not.toContain("NOT the gross rent income figure");
  });

  it("instructs that amount is GROSS rent for a rental statement", () => {
    expect(prompt.toLowerCase()).toContain("gross");
    // The assessable figure and the disbursed figure must be named as
    // different fields, or the model has no way to report both.
    expect(prompt).toContain("netReceived");
  });

  it("asks for each agent fee bucket separately", () => {
    // Lumping them loses the comparison against management_fee_pct, and the
    // sundry bucket feeds a different ATO line from the commission buckets.
    expect(prompt).toContain("managementFees");
    expect(prompt).toContain("lettingFees");
    expect(prompt).toContain("leaseFees");
    expect(prompt).toContain("sundryFees");
  });

  it("asks for third-party outgoings separately from agent fees", () => {
    expect(prompt).toContain("otherOutgoings");
  });

  it("includes the email content and the date it was told to assume", () => {
    expect(prompt).toContain("OWN10905");
    expect(prompt).toContain("2026-07-30");
  });
});

describe("parseStatementResponse — OWN10905", () => {
  const parsed = parseStatementResponse(OWN10905_RESPONSE);

  it("reports GROSS rent as the amount, not the $760.20 disbursed", () => {
    expect(parsed.amount).toBe(4400);
    expect(parsed.amount).not.toBe(760.2);
  });

  it("captures the disbursed figure in netReceived", () => {
    expect(parsed.netReceived).toBe(760.2);
  });

  it("captures each fee bucket", () => {
    expect(parsed.managementFees).toBe(242);
    expect(parsed.lettingFees).toBe(1210);
    expect(parsed.leaseFees).toBe(33);
    expect(parsed.sundryFees).toBe(8.8);
  });

  it("captures third-party outgoings without treating them as fees", () => {
    expect(parsed.otherOutgoings).toBe(2146);
  });

  it("reconciles: amount − fees − other outgoings = netReceived", () => {
    const fees =
      (parsed.managementFees ?? 0) +
      (parsed.lettingFees ?? 0) +
      (parsed.leaseFees ?? 0) +
      (parsed.sundryFees ?? 0);
    expect(fees).toBeCloseTo(1493.8, 2);
    expect((parsed.amount ?? 0) - fees - (parsed.otherOutgoings ?? 0)).toBeCloseTo(
      parsed.netReceived ?? 0,
      2,
    );
  });
});

/**
 * December 2025 for the same account, from the FY2026 folio summary. It carries
 * $6.80 of water usage recovered from the tenant, which is assessable income but
 * is NOT rent.
 *
 *   Money In   rent 4,400.00 + water 6.80 = 4,406.80
 *   Money Out                                 387.86
 *   Net                                     4,018.94
 */
const DECEMBER_RESPONSE = JSON.stringify({
  type: "rental_payment",
  amount: 4400,
  gstAmount: null,
  paymentDate: "2025-12-24",
  periodStart: null,
  periodEnd: null,
  supplier: "Rich & Oliva Pty Ltd",
  abn: "52003845047",
  category: null,
  propertyAddress: "56 Forbes St, Croydon Park NSW 2133",
  confidence: 0.9,
  managementFees: 121,
  lettingFees: null,
  leaseFees: null,
  sundryFees: null,
  otherOutgoings: 266.86,
  otherIncome: 6.8,
  otherIncomeNote: "Water usage recovered from tenant",
  netReceived: 4018.94,
});

describe("parseStatementResponse — tenant reimbursements", () => {
  const parsed = parseStatementResponse(DECEMBER_RESPONSE);

  it("keeps a water recovery OUT of gross rent", () => {
    // Folding it into `amount` would break the tenancy accrual cross-check in
    // lib/tax/rental-income.ts, which compares against weekly_rent x weeks.
    expect(parsed.amount).toBe(4400);
    expect(parsed.otherIncome).toBe(6.8);
  });

  it("records what the other income was for", () => {
    expect(parsed.otherIncomeNote).toBe("Water usage recovered from tenant");
  });

  it("reconciles ONLY when other income is included", () => {
    const fees = parsed.managementFees ?? 0;
    const withoutOtherIncome =
      (parsed.amount ?? 0) - fees - (parsed.otherOutgoings ?? 0);
    const withOtherIncome = withoutOtherIncome + (parsed.otherIncome ?? 0);

    // This is the whole reason the column exists: the identity is off by
    // exactly the reimbursement, so a correct statement would be flagged.
    expect(withoutOtherIncome).toBeCloseTo(4012.14, 2);
    expect(Math.abs(withoutOtherIncome - (parsed.netReceived ?? 0))).toBeCloseTo(
      6.8,
      2,
    );
    expect(withOtherIncome).toBeCloseTo(parsed.netReceived ?? 0, 2);
  });
});

describe("buildStatementPrompt — other income", () => {
  const prompt = buildStatementPrompt("a@b.com", "Statement", "body", "2026-07-30");

  it("asks for other income and what it was for", () => {
    expect(prompt).toContain("otherIncome");
    expect(prompt).toContain("otherIncomeNote");
  });

  it("states that a tenant reimbursement is not rent", () => {
    expect(prompt.toLowerCase()).toContain("reimburse");
  });
});

describe("parseStatementResponse — malformed and partial input", () => {
  it("extracts JSON embedded in surrounding prose", () => {
    const wrapped = `Here is the data you asked for:\n${OWN10905_RESPONSE}\nHope that helps.`;
    expect(parseStatementResponse(wrapped).amount).toBe(4400);
  });

  it("returns an unknown result with zero confidence when there is no JSON", () => {
    const parsed = parseStatementResponse("I could not read this document.");
    expect(parsed.type).toBe("unknown");
    expect(parsed.confidence).toBe(0);
    expect(parsed.amount).toBeNull();
  });

  it("returns an unknown result rather than throwing on malformed JSON", () => {
    const parsed = parseStatementResponse('{"type": "rental_payment", "amount":');
    expect(parsed.type).toBe("unknown");
    expect(parsed.confidence).toBe(0);
  });

  it("defaults absent fee fields to null rather than zero", () => {
    // Zero would assert "the agent charged nothing", which is a claim the
    // model never made. Null means not stated.
    const minimal = JSON.stringify({
      type: "rental_payment",
      amount: 2200,
      paymentDate: "2025-12-24",
      confidence: 0.8,
    });
    const parsed = parseStatementResponse(minimal);
    expect(parsed.amount).toBe(2200);
    expect(parsed.managementFees).toBeNull();
    expect(parsed.netReceived).toBeNull();
    expect(parsed.otherOutgoings).toBeNull();
  });

  it("does not coerce a string amount into a number", () => {
    // "$4,400.00" silently losing its comma is how a wrong figure reaches a
    // tax return. It must be reported as unreadable instead.
    const parsed = parseStatementResponse(
      JSON.stringify({
        type: "rental_payment",
        amount: "$4,400.00",
        confidence: 0.9,
      }),
    );
    expect(parsed.amount).toBeNull();
  });
});
