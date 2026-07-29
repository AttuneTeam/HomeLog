import { describe, expect, it } from "vitest";
import { buildRentalSchedule } from "@/lib/tax/rental-schedule";
import { computeApportionment } from "@/lib/tax/apportionment";

const soleOwner = computeApportionment(null, 365);
const halfOwner = computeApportionment(
  { ownership_pct: 50, days_available_for_rent: null, private_use_days: null },
  365,
);

const base = {
  propertyType: "investment",
  grossRent: 33_800,
  agentFees: 2_704,
  operatingExpenses: [],
  renovationExpenses: [],
  interest: 0,
  capitalWorks: 0,
  declineInValue: null,
  apportionment: soleOwner,
};

describe("buildRentalSchedule", () => {
  it("excludes a primary residence entirely", () => {
    const s = buildRentalSchedule({ ...base, propertyType: "primary_residence" });
    expect(s.excludedReason).toContain("Primary residence");
    expect(s.deductions).toEqual([]);
    expect(s.grossRent).toBe(0);
  });

  it("lists deductions in schedule order, computed lines last", () => {
    const s = buildRentalSchedule({
      ...base,
      interest: 21_450,
      capitalWorks: 2_500,
      declineInValue: 3_200,
      operatingExpenses: [
        { category: "water", amount: 900 },
        { category: "council_rates", amount: 1_800 },
        { category: "strata_fees", amount: 3_400 },
        { category: "insurance", amount: 1_200 },
        { category: "land_tax", amount: 700 },
        { category: "other", amount: 150 },
      ],
    });
    expect(s.deductions.map((d) => d.key)).toEqual([
      "body_corporate",
      "council_rates",
      "insurance",
      "interest",
      "land_tax",
      "agent_fees",
      "water",
      "sundry",
      "capital_works",
      "decline_in_value",
    ]);
  });

  it("omits lines with nothing in them", () => {
    const s = buildRentalSchedule(base);
    expect(s.deductions.map((d) => d.key)).toEqual(["agent_fees"]);
  });

  describe("classification routing", () => {
    it("counts a plain repair as a deduction", () => {
      const s = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 800,
            manual_classification: null,
            renovation_classification: "repair",
          },
        ],
      });
      expect(s.deductions.find((d) => d.key === "repairs")?.amount).toBe(800);
    });

    it("does NOT deduct an inherited capital improvement", () => {
      // The vocabulary mismatch previously routed this into repairs.
      const s = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 18_000,
            manual_classification: null,
            renovation_classification: "capital_improvement",
          },
        ],
      });
      expect(s.deductions.find((d) => d.key === "repairs")).toBeUndefined();
    });

    it("does NOT deduct an inherited initial repair", () => {
      const s = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 5_000,
            manual_classification: null,
            renovation_classification: "initial_repair",
          },
        ],
      });
      expect(s.deductions.find((d) => d.key === "repairs")).toBeUndefined();
    });

    it("honours a manual override in both directions", () => {
      const promoted = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 900,
            manual_classification: "Capital Works",
            renovation_classification: "repair",
          },
        ],
      });
      expect(promoted.deductions.find((d) => d.key === "repairs")).toBeUndefined();

      const demoted = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 900,
            manual_classification: "Repair",
            renovation_classification: "capital_improvement",
          },
        ],
      });
      expect(demoted.deductions.find((d) => d.key === "repairs")?.amount).toBe(
        900,
      );
    });

    it("excludes a non-claimable renovation", () => {
      const s = buildRentalSchedule({
        ...base,
        renovationExpenses: [
          {
            amount: 1_000,
            manual_classification: null,
            renovation_classification: "repair",
            claimable: false,
          },
        ],
      });
      expect(s.deductions.find((d) => d.key === "repairs")).toBeUndefined();
    });

    it("merges renovation repairs with operating repairs on one line", () => {
      const s = buildRentalSchedule({
        ...base,
        operatingExpenses: [{ category: "repairs_maintenance", amount: 400 }],
        renovationExpenses: [
          {
            amount: 600,
            manual_classification: null,
            renovation_classification: "repair",
          },
        ],
      });
      expect(s.deductions.filter((d) => d.key === "repairs")).toHaveLength(1);
      expect(s.deductions.find((d) => d.key === "repairs")?.amount).toBe(1_000);
    });
  });

  it("computes the net result", () => {
    const s = buildRentalSchedule({ ...base, interest: 10_000 });
    expect(s.totalDeductions).toBe(12_704);
    expect(s.netResult).toBe(33_800 - 12_704);
    expect(s.isLoss).toBe(false);
  });

  it("reports a loss when deductions exceed income", () => {
    const s = buildRentalSchedule({ ...base, interest: 40_000 });
    expect(s.netResult).toBeLessThan(0);
    expect(s.isLoss).toBe(true);
  });

  it("apportions income and deductions to the owner's share", () => {
    const s = buildRentalSchedule({
      ...base,
      apportionment: halfOwner,
      interest: 10_000,
    });
    expect(s.grossRent).toBe(16_900);
    expect(s.deductions.find((d) => d.key === "interest")?.amount).toBe(5_000);
    expect(s.totalDeductions).toBe(6_352);
  });

  it("treats missing gross rent as zero rather than failing", () => {
    const s = buildRentalSchedule({ ...base, grossRent: null, agentFees: 0 });
    expect(s.grossRent).toBe(0);
    expect(s.netResult).toBe(0);
  });

  it("omits decline in value when no QS figure exists", () => {
    const s = buildRentalSchedule({ ...base, declineInValue: null });
    expect(s.deductions.find((d) => d.key === "decline_in_value")).toBeUndefined();
  });
});
