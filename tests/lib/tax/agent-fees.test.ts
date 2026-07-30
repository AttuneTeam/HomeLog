import { describe, expect, it } from "vitest";
import {
  confirmedAgentFeesForFy,
  estimatedAgentFeesForFy,
  resolveAgentFees,
} from "@/lib/tax/agent-fees";

const FY = 2026; // 1 Jul 2025 – 30 Jun 2026

/** A payment with confirmed fees, from statement #1 (OWN10905, 28 Nov 2025). */
const statement1 = {
  payment_date: "2025-11-28",
  management_fees: 242,
  letting_fees: 1210,
  lease_fees: 33,
  sundry_fees: 8.8,
  fees_confirmed_at: "2026-07-30T00:00:00Z",
};

/** Statement #7, 29 May 2026 — management and bank charges only. */
const statement7 = {
  payment_date: "2026-05-29",
  management_fees: 121,
  letting_fees: null,
  lease_fees: null,
  sundry_fees: 4.4,
  fees_confirmed_at: "2026-07-30T00:00:00Z",
};

/** A payment with no fee data at all, as an email-ingested row starts out. */
const bareePayment = {
  payment_date: "2026-01-30",
  management_fees: null,
  letting_fees: null,
  lease_fees: null,
  sundry_fees: null,
  fees_confirmed_at: null,
};

/** The real tenancy: $1,100/wk from 22 Nov 2025, 5% management fee. */
const tenancy = [
  {
    start_date: "2025-11-22",
    end_date: null,
    weekly_rent: 1100,
    management_fee_pct: 5,
  },
];

describe("confirmedAgentFeesForFy", () => {
  it("splits commission from sundries", () => {
    // Management, letting and lease fees are commission and feed the ATO
    // "Property agent fees and commission" line. Bank and admin charges are not
    // commission and feed "Sundry rental expenses".
    const result = confirmedAgentFeesForFy([statement1], FY);
    expect(result).not.toBeNull();
    expect(result!.commission).toBeCloseTo(1485, 2); // 242 + 1210 + 33
    expect(result!.sundries).toBeCloseTo(8.8, 2);
  });

  it("sums across several statements in the year", () => {
    const result = confirmedAgentFeesForFy([statement1, statement7], FY);
    expect(result!.commission).toBeCloseTo(1606, 2); // + 121
    expect(result!.sundries).toBeCloseTo(13.2, 2); // 8.80 + 4.40
  });

  it("EXCLUDES fees that have not been confirmed", () => {
    // An extraction is a model's proposal. Until a human accepts it the figure
    // is not claimable — the same gate loan_statements.confirmed_at applies.
    const unconfirmed = { ...statement1, fees_confirmed_at: null };
    expect(confirmedAgentFeesForFy([unconfirmed], FY)).toBeNull();
  });

  it("returns null when no payment carries confirmed fees", () => {
    // Null means unknown, NOT "the agent charged nothing". A caller must not
    // report it as zero.
    expect(confirmedAgentFeesForFy([bareePayment], FY)).toBeNull();
    expect(confirmedAgentFeesForFy([], FY)).toBeNull();
  });

  it("excludes payments outside the financial year", () => {
    const priorYear = { ...statement1, payment_date: "2025-06-30" };
    expect(confirmedAgentFeesForFy([priorYear], FY)).toBeNull();
  });

  it("respects a non-July financial year start", () => {
    // With a 1 April start, FY2026 runs 1 Apr 2025 – 31 Mar 2026, so the 29 May
    // 2026 statement falls in the NEXT year and must be excluded.
    const result = confirmedAgentFeesForFy([statement1, statement7], FY, 4, 1);
    expect(result!.commission).toBeCloseTo(1485, 2);
    expect(result!.sundries).toBeCloseTo(8.8, 2);
  });

  it("treats a null fee as zero, not as a missing statement", () => {
    // Statement #7 charged no letting or lease fee. That is a real zero.
    const result = confirmedAgentFeesForFy([statement7], FY);
    expect(result!.commission).toBeCloseTo(121, 2);
  });
});

describe("estimatedAgentFeesForFy", () => {
  it("computes weeks x weekly rent x fee percentage", () => {
    // 22 Nov 2025 to 30 Jun 2026 is 220 days, measured exclusively as the
    // accrual does. 220/7 x 1100 x 5%.
    const expected = (220 / 7) * 1100 * 0.05;
    expect(estimatedAgentFeesForFy(tenancy, FY)).toBeCloseTo(expected, 2);
  });

  it("returns null when no tenancy states a fee percentage", () => {
    const noPct = [{ ...tenancy[0], management_fee_pct: null }];
    expect(estimatedAgentFeesForFy(noPct, FY)).toBeNull();
    expect(estimatedAgentFeesForFy([], FY)).toBeNull();
  });

  it("clamps a tenancy spanning the year boundary", () => {
    const spanning = [
      {
        start_date: "2020-01-01",
        end_date: "2030-01-01",
        weekly_rent: 1000,
        management_fee_pct: 10,
      },
    ];
    expect(estimatedAgentFeesForFy(spanning, FY)).toBeCloseTo(52 * 1000 * 0.1, 2);
  });
});

describe("resolveAgentFees", () => {
  it("prefers confirmed actuals and labels the source", () => {
    const r = resolveAgentFees([statement1, statement7], tenancy, FY);
    expect(r.source).toBe("actual");
    expect(r.commission).toBeCloseTo(1606, 2);
    expect(r.sundries).toBeCloseTo(13.2, 2);
  });

  it("falls back to the estimate and says so", () => {
    const r = resolveAgentFees([bareePayment], tenancy, FY);
    expect(r.source).toBe("estimated");
    expect(r.commission).toBeCloseTo((220 / 7) * 1100 * 0.05, 2);
    // An estimate is a commission figure only; a percentage model cannot
    // produce a bank charge.
    expect(r.sundries).toBe(0);
  });

  it("NEVER sums the actual and the estimate", () => {
    // The statement's $242 management fee is exactly what 5% of $4,400
    // produces. Adding them double-counts it — this is the guard.
    const r = resolveAgentFees([statement1, statement7], tenancy, FY);
    const estimate = estimatedAgentFeesForFy(tenancy, FY)!;
    expect(r.commission).toBeLessThan(1606 + estimate);
    expect(r.commission).toBeCloseTo(1606, 2);
  });

  it("uses the estimate when fees exist but are unconfirmed", () => {
    const unconfirmed = { ...statement1, fees_confirmed_at: null };
    const r = resolveAgentFees([unconfirmed], tenancy, FY);
    expect(r.source).toBe("estimated");
    expect(r.unconfirmedCount).toBe(1);
  });

  it("reports both figures so a caller can show the cross-check", () => {
    const r = resolveAgentFees([statement1], tenancy, FY);
    expect(r.actual).not.toBeNull();
    expect(r.estimated).not.toBeNull();
    expect(r.actual!.commission).toBeCloseTo(1485, 2);
  });

  it("flags a PARTIAL actual when only some payments carry confirmed fees", () => {
    // The real FY2026 case: statements #1 and #7 are in hand, #2–#6 are not.
    // The actual is genuine but incomplete, and here it is even SMALLER than
    // the estimate — so silently preferring it would understate the deduction
    // with no indication why. The caller must be able to disclose this.
    const r = resolveAgentFees(
      [statement1, statement7, bareePayment],
      tenancy,
      FY,
    );
    expect(r.source).toBe("actual");
    expect(r.partial).toBe(true);
    expect(r.paymentsInYear).toBe(3);
    expect(r.paymentsWithConfirmedFees).toBe(2);
  });

  it("is not partial when every payment in the year is confirmed", () => {
    const r = resolveAgentFees([statement1, statement7], tenancy, FY);
    expect(r.partial).toBe(false);
  });

  it("reports source null when neither figure is available", () => {
    // No confirmed fees and no fee percentage. Zero here would assert the agent
    // charged nothing, which nothing in the data supports.
    const noPct = [{ ...tenancy[0], management_fee_pct: null }];
    const r = resolveAgentFees([bareePayment], noPct, FY);
    expect(r.source).toBeNull();
    expect(r.actual).toBeNull();
    expect(r.estimated).toBeNull();
  });

  it("resolves the real FY2026 figures for OWN10905", () => {
    const r = resolveAgentFees([statement1, statement7], tenancy, FY);
    expect(r.commission + r.sundries).toBeCloseTo(1619.2, 2);
    // Against the agent's own annual summary the true FY2026 total is
    // $2,851.20; the gap is the five statements not yet supplied, which
    // `partial` exists to surface rather than hide.
    expect(r.commission + r.sundries).toBeLessThan(2851.2);
  });
});
