import { describe, expect, it } from "vitest";
import { rentalStatementSchema } from "@/lib/ai/extract-rental-statement";

/** A correct extraction of statement #1 (OWN10905, 28 Nov 2025). */
const valid = {
  gross_rent: 4400,
  management_fees: 242,
  letting_fees: 1210,
  lease_fees: 33,
  sundry_fees: 8.8,
  other_outgoings: 2146,
  other_income: null,
  other_income_note: null,
  net_received: 760.2,
  agent_name: "Rich & Oliva Pty Ltd",
  statement_ref: "Statement #1 - OWN10905",
  period_start: "2025-11-22",
  period_end: "2025-12-19",
  statement_date: "2025-11-28",
  confidence: 0.95,
  notes: null,
};

describe("rentalStatementSchema", () => {
  it("accepts a well-formed extraction", () => {
    expect(rentalStatementSchema.parse(valid)).toMatchObject({
      gross_rent: 4400,
      net_received: 760.2,
      agent_name: "Rich & Oliva Pty Ltd",
    });
  });

  it("accepts nulls for every field that could be absent", () => {
    const sparse = {
      ...valid,
      gross_rent: null,
      management_fees: null,
      letting_fees: null,
      lease_fees: null,
      sundry_fees: null,
      other_outgoings: null,
      net_received: null,
      agent_name: null,
      statement_ref: null,
      period_start: null,
      period_end: null,
      statement_date: null,
    };
    expect(() => rentalStatementSchema.parse(sparse)).not.toThrow();
  });

  it("rejects a string amount rather than coercing it", () => {
    // A model returning "$4,400.00" must fail loudly. Coercion would silently
    // drop the comma or the currency symbol and produce a wrong figure that
    // ends up in a tax return.
    expect(() =>
      rentalStatementSchema.parse({ ...valid, gross_rent: "4400.00" }),
    ).toThrow();
    expect(() =>
      rentalStatementSchema.parse({ ...valid, net_received: "$760.20" }),
    ).toThrow();
  });

  it("rejects a confidence outside 0–1", () => {
    expect(() =>
      rentalStatementSchema.parse({ ...valid, confidence: 1.5 }),
    ).toThrow();
    expect(() =>
      rentalStatementSchema.parse({ ...valid, confidence: -0.1 }),
    ).toThrow();
  });

  it("requires a confidence — it cannot be omitted", () => {
    const { confidence: _omitted, ...withoutConfidence } = valid;
    expect(() => rentalStatementSchema.parse(withoutConfidence)).toThrow();
  });

  it("rejects a missing gross_rent key entirely", () => {
    // Null is a valid answer ("not found"); an absent key is a malformed
    // response and must not be treated as null.
    const { gross_rent: _omitted, ...withoutRent } = valid;
    expect(() => rentalStatementSchema.parse(withoutRent)).toThrow();
  });

  it("rejects a missing other_outgoings key", () => {
    // This one matters especially: absent must not silently become null, or a
    // statement where the agent paid a tradesperson would appear to reconcile
    // when it does not.
    const { other_outgoings: _omitted, ...without } = valid;
    expect(() => rentalStatementSchema.parse(without)).toThrow();
  });

  it("accepts a zero fee as distinct from null", () => {
    // Zero asserts the agent charged nothing; null means not stated. The
    // schema must carry that difference through.
    const parsed = rentalStatementSchema.parse({ ...valid, letting_fees: 0 });
    expect(parsed.letting_fees).toBe(0);
    const nulled = rentalStatementSchema.parse({
      ...valid,
      letting_fees: null,
    });
    expect(nulled.letting_fees).toBeNull();
  });

  it("keeps the statement reference exactly as printed", () => {
    const parsed = rentalStatementSchema.parse({
      ...valid,
      statement_ref: "Statement #7 - OWN10905",
    });
    expect(parsed.statement_ref).toBe("Statement #7 - OWN10905");
  });

  it("carries other income and its note together", () => {
    const parsed = rentalStatementSchema.parse({
      ...valid,
      other_income: 6.8,
      other_income_note: "Water usage recovered from tenant",
    });
    expect(parsed.other_income).toBe(6.8);
    expect(parsed.other_income_note).toBe("Water usage recovered from tenant");
  });

  it("accepts a statement that does not reconcile", () => {
    // The schema reports what was read. A balance brought forward legitimately
    // breaks the identity, and forcing a balance here would destroy the very
    // discrepancy the reconciliation exists to surface.
    expect(() =>
      rentalStatementSchema.parse({ ...valid, net_received: 5000 }),
    ).not.toThrow();
  });
});
