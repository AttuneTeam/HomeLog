import { describe, expect, it } from "vitest";
import { buildPortfolioSummary } from "@/lib/tax/portfolio";
import { buildRentalSchedule } from "@/lib/tax/rental-schedule";
import { computeApportionment } from "@/lib/tax/apportionment";

const soleOwner = computeApportionment(null, 365);

function schedule(over: Record<string, unknown> = {}) {
  return buildRentalSchedule({
    propertyType: "investment",
    grossRent: 33_800,
    agentFees: 2_704,
    operatingExpenses: [{ category: "council_rates", amount: 1_800 }],
    renovationExpenses: [],
    interest: 21_450,
    capitalWorks: 2_500,
    declineInValue: null,
    apportionment: soleOwner,
    ...over,
  });
}

describe("buildPortfolioSummary", () => {
  it("reconciles the portfolio net with the sum of property nets", () => {
    // The property this whole aggregation exists to guarantee.
    const a = schedule();
    const b = schedule({ grossRent: 20_000, interest: 9_000 });
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A St", schedule: a, costBase: 700_000 },
      { propertyId: "b", address: "B St", schedule: b, costBase: 500_000 },
    ]);

    expect(s.netResult).toBeCloseTo(a.netResult + b.netResult, 6);
    expect(s.totalGrossRent).toBeCloseTo(a.grossRent + b.grossRent, 6);
    expect(s.totalDeductions).toBeCloseTo(
      a.totalDeductions + b.totalDeductions,
      6,
    );
    // And the identity that must hold at portfolio level too.
    expect(s.netResult).toBeCloseTo(s.totalGrossRent - s.totalDeductions, 6);
  });

  it("sums deduction lines by key across properties", () => {
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: schedule(), costBase: 0 },
      { propertyId: "b", address: "B", schedule: schedule(), costBase: 0 },
    ]);
    const interest = s.deductionTotals.find((d) => d.key === "interest");
    expect(interest?.amount).toBeCloseTo(21_450 * 2, 6);
    // Line totals must also reconcile with the summed property totals.
    const lineSum = s.deductionTotals.reduce((sum, d) => sum + d.amount, 0);
    expect(lineSum).toBeCloseTo(s.totalDeductions, 6);
  });

  it("separates an excluded primary residence with its reason", () => {
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: schedule(), costBase: 100 },
      {
        propertyId: "home",
        address: "Home",
        schedule: schedule({ propertyType: "primary_residence" }),
        costBase: 900_000,
      },
    ]);
    expect(s.included).toHaveLength(1);
    expect(s.excluded).toHaveLength(1);
    expect(s.excluded[0].reason).toContain("Primary residence");
    // An excluded property contributes nothing to any total.
    expect(s.totalCostBase).toBe(100);
    expect(s.totalGrossRent).toBeCloseTo(schedule().grossRent, 6);
  });

  it("counts properties individually at a loss", () => {
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: schedule(), costBase: 0 },
      {
        propertyId: "b",
        address: "B",
        schedule: schedule({ interest: 60_000 }),
        costBase: 0,
      },
    ]);
    expect(s.propertiesAtLoss).toBe(1);
  });

  it("reports a portfolio loss when deductions exceed income overall", () => {
    const s = buildPortfolioSummary([
      {
        propertyId: "a",
        address: "A",
        schedule: schedule({ interest: 60_000 }),
        costBase: 0,
      },
    ]);
    expect(s.isLoss).toBe(true);
    expect(s.netResult).toBeLessThan(0);
  });

  it("offsets a loss-making property against a profitable one", () => {
    const profit = schedule({ interest: 0, capitalWorks: 0 });
    const loss = schedule({ grossRent: 5_000, interest: 40_000 });
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: profit, costBase: 0 },
      { propertyId: "b", address: "B", schedule: loss, costBase: 0 },
    ]);
    expect(s.netResult).toBeCloseTo(profit.netResult + loss.netResult, 6);
    expect(s.propertiesAtLoss).toBe(1);
  });

  it("carries the cost base per property and totals it", () => {
    const s = buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: schedule(), costBase: 700_000 },
      { propertyId: "b", address: "B", schedule: schedule(), costBase: 512_500 },
    ]);
    expect(s.totalCostBase).toBe(1_212_500);
    expect(s.included[0].costBase).toBe(700_000);
  });

  it("returns empty totals for an empty portfolio", () => {
    const s = buildPortfolioSummary([]);
    expect(s.included).toEqual([]);
    expect(s.netResult).toBe(0);
    expect(s.isLoss).toBe(false);
    expect(s.deductionTotals).toEqual([]);
  });

  it("does not mutate the schedules it aggregates", () => {
    const a = schedule();
    const originalInterest = a.deductions.find((d) => d.key === "interest")!.amount;
    buildPortfolioSummary([
      { propertyId: "a", address: "A", schedule: a, costBase: 0 },
      { propertyId: "b", address: "B", schedule: a, costBase: 0 },
    ]);
    // Summing by key must not accumulate into the source line objects.
    expect(a.deductions.find((d) => d.key === "interest")!.amount).toBe(
      originalInterest,
    );
  });
});
