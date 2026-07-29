import { describe, expect, it } from "vitest";
import {
  RECONCILIATION_TOLERANCE,
  reconcileStatement,
} from "@/lib/tax/statement-reconciliation";

/** Statement #1, OWN10905, 28 Nov 2025. */
const statement1 = {
  amount: 4400,
  management_fees: 242,
  letting_fees: 1210,
  lease_fees: 33,
  sundry_fees: 8.8,
  other_outgoings: 2146,
  other_income: null,
  net_received: 760.2,
};

/** December 2025 — carries $6.80 of water usage recovered from the tenant. */
const december = {
  amount: 4400,
  management_fees: 121,
  letting_fees: null,
  lease_fees: null,
  sundry_fees: null,
  other_outgoings: 266.86,
  other_income: 6.8,
  net_received: 4018.94,
};

describe("reconcileStatement", () => {
  it("ties on statement #1", () => {
    // 4400 − (242 + 1210 + 33 + 8.80) − 2146 = 760.20
    const r = reconcileStatement(statement1);
    expect(r.applicable).toBe(true);
    expect(r.ties).toBe(true);
    expect(r.totalFees).toBeCloseTo(1493.8, 2);
    expect(r.computedNet).toBeCloseTo(760.2, 2);
    expect(r.difference).toBeCloseTo(0, 2);
  });

  it("ties on December ONLY because other income is included", () => {
    // The reason other_income exists. Without it the identity is off by exactly
    // the $6.80 recovery and a correct statement would be reported as broken.
    const r = reconcileStatement(december);
    expect(r.ties).toBe(true);
    expect(r.computedNet).toBeCloseTo(4018.94, 2);

    const withoutOtherIncome = reconcileStatement({
      ...december,
      other_income: null,
    });
    expect(withoutOtherIncome.ties).toBe(false);
    expect(withoutOtherIncome.difference).toBeCloseTo(-6.8, 2);
  });

  it("counts other income as money IN, not as a reduction in fees", () => {
    const r = reconcileStatement(december);
    expect(r.totalMoneyIn).toBeCloseTo(4406.8, 2);
    expect(r.totalFees).toBeCloseTo(121, 2);
  });

  it("passes a discrepancy inside the tolerance", () => {
    // Rounding on a GST-inclusive fee can leave a cent or two.
    const r = reconcileStatement({ ...statement1, net_received: 760.9 });
    expect(r.ties).toBe(true);
    expect(Math.abs(r.difference)).toBeLessThanOrEqual(RECONCILIATION_TOLERANCE);
  });

  it("fails a discrepancy beyond the tolerance", () => {
    const r = reconcileStatement({ ...statement1, net_received: 700 });
    expect(r.ties).toBe(false);
    expect(r.difference).toBeCloseTo(60.2, 2);
  });

  it("is not applicable when net_received is absent", () => {
    // Nothing to reconcile against. That is unknown, not a failure — reporting
    // it as broken would train people to ignore the warning.
    const r = reconcileStatement({ ...statement1, net_received: null });
    expect(r.applicable).toBe(false);
    expect(r.ties).toBe(false);
  });

  it("is not applicable when no fees or outgoings are recorded at all", () => {
    // A bare email-ingested row. There is no statement detail to check.
    const r = reconcileStatement({
      amount: 2200,
      management_fees: null,
      letting_fees: null,
      lease_fees: null,
      sundry_fees: null,
      other_outgoings: null,
      other_income: null,
      net_received: null,
    });
    expect(r.applicable).toBe(false);
  });

  it("reports a brought-forward balance mismatch without throwing", () => {
    // A balance carried in from the previous statement legitimately breaks the
    // identity. It must be reported, never treated as user error, and never
    // block a save.
    const r = reconcileStatement({ ...statement1, net_received: 900.2 });
    expect(() => reconcileStatement({ ...statement1, net_received: 900.2 })).not.toThrow();
    expect(r.applicable).toBe(true);
    expect(r.ties).toBe(false);
    expect(r.difference).toBeCloseTo(-140, 2);
  });

  it("treats every absent component as zero, not as a failure", () => {
    // Statement #7: management fee and bank charge only.
    const r = reconcileStatement({
      amount: 2200,
      management_fees: 121,
      letting_fees: null,
      lease_fees: null,
      sundry_fees: 4.4,
      other_outgoings: null,
      other_income: null,
      net_received: 2074.6,
    });
    expect(r.ties).toBe(true);
    expect(r.computedNet).toBeCloseTo(2074.6, 2);
  });

  it("never throws on a zero-amount statement", () => {
    const r = reconcileStatement({
      amount: 0,
      management_fees: 121,
      letting_fees: null,
      lease_fees: null,
      sundry_fees: null,
      other_outgoings: null,
      other_income: null,
      net_received: 0,
    });
    expect(r.applicable).toBe(true);
    expect(r.ties).toBe(false);
    expect(r.difference).toBeCloseTo(-121, 2);
  });
});
