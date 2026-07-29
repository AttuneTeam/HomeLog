import { describe, expect, it } from "vitest";
import {
  apportionDeduction,
  apportionIncome,
  computeApportionment,
} from "@/lib/tax/apportionment";

const DAYS = 365;

describe("computeApportionment", () => {
  it("assumes sole ownership and a full year when nothing is recorded", () => {
    const a = computeApportionment(null, DAYS);
    expect(a.ownershipFraction).toBe(1);
    expect(a.deductibleDayFraction).toBe(1);
    expect(a.assumedSoleOwnership).toBe(true);
    expect(a.assumedFullYear).toBe(true);
  });

  it("stops assuming once facts are recorded", () => {
    const a = computeApportionment(
      {
        ownership_pct: 50,
        days_available_for_rent: 200,
        private_use_days: null,
      },
      DAYS,
    );
    expect(a.assumedSoleOwnership).toBe(false);
    expect(a.assumedFullYear).toBe(false);
  });

  it("converts an ownership percentage to a fraction", () => {
    const a = computeApportionment(
      { ownership_pct: 50, days_available_for_rent: null, private_use_days: null },
      DAYS,
    );
    expect(a.ownershipFraction).toBe(0.5);
  });

  it("subtracts private use from days available", () => {
    // Available 300 days, 30 of them used privately -> 270 deductible days.
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 300,
        private_use_days: 30,
      },
      DAYS,
    );
    expect(a.deductibleDayFraction).toBeCloseTo(270 / 365, 10);
  });

  it("subtracts private use from a full year when availability is unrecorded", () => {
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: null, private_use_days: 65 },
      DAYS,
    );
    expect(a.deductibleDayFraction).toBeCloseTo(300 / 365, 10);
    // Availability was still not recorded, even though private use was.
    expect(a.assumedFullYear).toBe(true);
  });

  it("never produces a negative fraction", () => {
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 10,
        private_use_days: 100,
      },
      DAYS,
    );
    expect(a.deductibleDayFraction).toBe(0);
  });

  it("caps the day fraction at 1", () => {
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 400,
        private_use_days: null,
      },
      DAYS,
    );
    expect(a.deductibleDayFraction).toBe(1);
  });

  it("uses 366 days in a leap year", () => {
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 183, private_use_days: null },
      366,
    );
    expect(a.deductibleDayFraction).toBeCloseTo(183 / 366, 10);
  });
});

describe("mid-year acquisition", () => {
  // Regression: every test above assumed a property held all year, which is
  // why this shipped. A property settled on 27 Oct 2025 is owned for 247 days
  // of FY2025–26. Expenses it incurs fall wholly inside those 247 days, so
  // dividing by 365 charges the taxpayer twice for the same part-year.
  const OWNED = 247;

  it("does not reduce deductions when available for the whole period owned", () => {
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: OWNED,
        private_use_days: null,
      },
      DAYS,
      OWNED,
    );
    expect(a.deductibleDayFraction).toBe(1);
  });

  it("claims the full interest on a loan that did not exist earlier in the year", () => {
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: OWNED, private_use_days: null },
      DAYS,
      OWNED,
    );
    // The reported case: $75,763.60 was being cut to $51,270.16.
    expect(apportionDeduction(75_763.6, a)).toBeCloseTo(75_763.6, 6);
  });

  it("still reduces for private use within the period owned", () => {
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 217, private_use_days: null },
      DAYS,
      OWNED,
    );
    expect(a.deductibleDayFraction).toBeCloseTo(217 / 247, 10);
  });

  it("assumes availability for the period owned, not the whole year", () => {
    const a = computeApportionment(null, DAYS, OWNED);
    expect(a.deductibleDayFraction).toBe(1);
    expect(a.assumedFullYear).toBe(true);
  });

  it("caps recorded availability at the period owned", () => {
    // A stale 365 recorded against a property owned 247 days must not produce
    // a fraction above 1.
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 365, private_use_days: null },
      DAYS,
      OWNED,
    );
    expect(a.deductibleDayFraction).toBe(1);
  });

  it("still combines with a part ownership share", () => {
    const a = computeApportionment(
      { ownership_pct: 50, days_available_for_rent: OWNED, private_use_days: null },
      DAYS,
      OWNED,
    );
    expect(apportionDeduction(1000, a)).toBeCloseTo(500, 10);
  });

  it("returns zero when the property was not owned during the year", () => {
    const a = computeApportionment(null, DAYS, 0);
    expect(a.deductibleDayFraction).toBe(0);
    expect(apportionDeduction(1000, a)).toBe(0);
  });

  it("behaves as before for a property held all year", () => {
    const withOwned = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 200, private_use_days: null },
      DAYS,
      DAYS,
    );
    const withoutOwned = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 200, private_use_days: null },
      DAYS,
    );
    expect(withOwned.deductibleDayFraction).toBeCloseTo(200 / 365, 10);
    expect(withoutOwned.deductibleDayFraction).toBeCloseTo(200 / 365, 10);
  });
});

describe("apportionIncome", () => {
  it("applies ownership only", () => {
    const a = computeApportionment(
      { ownership_pct: 50, days_available_for_rent: null, private_use_days: null },
      DAYS,
    );
    expect(apportionIncome(33_800, a)).toBe(16_900);
  });

  it("is NOT reduced by availability", () => {
    // Rent received is rent received. Availability apportions deductions, not
    // income — reducing income by it would understate assessable rent.
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 100,
        private_use_days: null,
      },
      DAYS,
    );
    expect(apportionIncome(20_000, a)).toBe(20_000);
  });

  it("is NOT reduced by private use", () => {
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 365,
        private_use_days: 100,
      },
      DAYS,
    );
    expect(apportionIncome(20_000, a)).toBe(20_000);
  });

  it("passes through untouched at sole ownership", () => {
    expect(apportionIncome(1234.56, computeApportionment(null, DAYS))).toBe(
      1234.56,
    );
  });
});

describe("apportionDeduction", () => {
  it("applies ownership and availability together", () => {
    const a = computeApportionment(
      {
        ownership_pct: 50,
        days_available_for_rent: 200,
        private_use_days: null,
      },
      DAYS,
    );
    expect(apportionDeduction(1000, a)).toBeCloseTo(1000 * 0.5 * (200 / 365), 10);
  });

  it("is reduced by private use where income is not", () => {
    const a = computeApportionment(
      {
        ownership_pct: 100,
        days_available_for_rent: 365,
        private_use_days: 73,
      },
      DAYS,
    );
    expect(apportionDeduction(1000, a)).toBeCloseTo(1000 * (292 / 365), 10);
    expect(apportionIncome(1000, a)).toBe(1000);
  });

  it("passes through untouched when nothing is recorded", () => {
    expect(apportionDeduction(500, computeApportionment(null, DAYS))).toBe(500);
  });

  it("returns 0 when no days are deductible", () => {
    const a = computeApportionment(
      { ownership_pct: 100, days_available_for_rent: 0, private_use_days: null },
      DAYS,
    );
    expect(apportionDeduction(1000, a)).toBe(0);
  });
});
