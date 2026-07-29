import { describe, expect, it } from "vitest";
import { capitalTotalsForCostBase } from "@/lib/tax/cost-base";

const reno = (
  classification: "repair" | "capital_improvement" | "initial_repair",
  expenses: Array<{ amount: number; manual_classification?: null | "Repair" | "Capital Works" | "Immediate Repair" }>,
  claimable: boolean | null = true,
) => ({
  classification,
  claimable,
  expenses: expenses.map((e) => ({
    amount: e.amount,
    manual_classification: e.manual_classification ?? null,
  })),
});

describe("capitalTotalsForCostBase", () => {
  it("accumulates across every year, not just one", () => {
    // The defect this guards: filtering to the reported financial year
    // understates the base and overstates a future capital gain.
    const totals = capitalTotalsForCostBase([
      reno("capital_improvement", [{ amount: 18_000 }]), // FY2020
      reno("capital_improvement", [{ amount: 45_168 }]), // FY2026
    ]);
    expect(totals.capitalImprovements).toBe(63_168);
  });

  it("separates initial repairs from capital improvements", () => {
    const totals = capitalTotalsForCostBase([
      reno("initial_repair", [{ amount: 5_000 }]),
      reno("capital_improvement", [{ amount: 12_000 }]),
    ]);
    expect(totals.initialRepairs).toBe(5_000);
    expect(totals.capitalImprovements).toBe(12_000);
  });

  it("excludes plain repairs, which are deducted rather than capitalised", () => {
    const totals = capitalTotalsForCostBase([
      reno("repair", [{ amount: 900 }]),
    ]);
    expect(totals).toEqual({ initialRepairs: 0, capitalImprovements: 0 });
  });

  it("excludes non-claimable renovations", () => {
    const totals = capitalTotalsForCostBase([
      reno("capital_improvement", [{ amount: 30_000 }], false),
    ]);
    expect(totals.capitalImprovements).toBe(0);
  });

  it("treats a null claimable flag as claimable", () => {
    const totals = capitalTotalsForCostBase([
      reno("capital_improvement", [{ amount: 1_000 }], null),
    ]);
    expect(totals.capitalImprovements).toBe(1_000);
  });

  it("honours a manual override in both directions", () => {
    const promoted = capitalTotalsForCostBase([
      reno("repair", [{ amount: 800, manual_classification: "Capital Works" }]),
    ]);
    expect(promoted.capitalImprovements).toBe(800);

    const demoted = capitalTotalsForCostBase([
      reno("capital_improvement", [
        { amount: 800, manual_classification: "Repair" },
      ]),
    ]);
    expect(demoted.capitalImprovements).toBe(0);
  });

  it("sums several expenses within one renovation", () => {
    const totals = capitalTotalsForCostBase([
      reno("capital_improvement", [{ amount: 100 }, { amount: 250 }]),
    ]);
    expect(totals.capitalImprovements).toBe(350);
  });

  it("returns zeroes for no renovations", () => {
    expect(capitalTotalsForCostBase([])).toEqual({
      initialRepairs: 0,
      capitalImprovements: 0,
    });
  });
});
