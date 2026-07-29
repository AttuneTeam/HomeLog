import { describe, expect, it } from "vitest";
import { loanStatementSchema } from "@/lib/ai/extract-loan-statement";

const valid = {
  interest_paid: 21450.32,
  fees_charged: 395,
  lender: "Test Bank",
  account_ref: "****1234",
  period_start: "2025-07-01",
  period_end: "2026-06-30",
  confidence: 0.92,
  notes: null,
};

describe("loanStatementSchema", () => {
  it("accepts a well-formed extraction", () => {
    expect(loanStatementSchema.parse(valid)).toMatchObject({
      interest_paid: 21450.32,
      lender: "Test Bank",
    });
  });

  it("accepts nulls for every field that could be absent", () => {
    const sparse = {
      ...valid,
      interest_paid: null,
      fees_charged: null,
      lender: null,
      account_ref: null,
      period_start: null,
      period_end: null,
      notes: null,
    };
    expect(() => loanStatementSchema.parse(sparse)).not.toThrow();
  });

  it("rejects a string amount rather than coercing it", () => {
    // A model returning "$21,450.32" must fail loudly. Coercion here would
    // silently drop the comma or the currency symbol and produce a wrong
    // figure that ends up in a tax return.
    expect(() =>
      loanStatementSchema.parse({ ...valid, interest_paid: "21450.32" }),
    ).toThrow();
  });

  it("rejects a confidence outside 0–1", () => {
    expect(() =>
      loanStatementSchema.parse({ ...valid, confidence: 1.5 }),
    ).toThrow();
    expect(() =>
      loanStatementSchema.parse({ ...valid, confidence: -0.1 }),
    ).toThrow();
  });

  it("requires a confidence — it cannot be omitted", () => {
    const { confidence: _omitted, ...withoutConfidence } = valid;
    expect(() => loanStatementSchema.parse(withoutConfidence)).toThrow();
  });

  it("rejects a missing interest_paid key entirely", () => {
    // Null is a valid answer ("not found"); an absent key is a malformed
    // response and must not be treated as null.
    const { interest_paid: _omitted, ...withoutInterest } = valid;
    expect(() => loanStatementSchema.parse(withoutInterest)).toThrow();
  });

  it("keeps account masking exactly as read", () => {
    const parsed = loanStatementSchema.parse({
      ...valid,
      account_ref: "XXXX-XXXX-9876",
    });
    expect(parsed.account_ref).toBe("XXXX-XXXX-9876");
  });

  it("accepts a negative interest figure so a credit is not silently dropped", () => {
    // Rare, but an interest refund is real. The DB check constrains what can
    // be stored; the schema's job is to report faithfully what was read.
    expect(() =>
      loanStatementSchema.parse({ ...valid, interest_paid: -120 }),
    ).not.toThrow();
  });
});
