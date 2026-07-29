import { describe, expect, it } from "vitest";
import {
  MATERIAL_DIVERGENCE_MIN_ABSOLUTE,
  MATERIAL_DIVERGENCE_PCT,
  accruedRentForFy,
  actualRentForFy,
  resolveRentalIncome,
} from "@/lib/tax/rental-income";

const FY = 2026; // 1 Jul 2025 – 30 Jun 2026

const fullYearTenancy = [
  { start_date: "2025-07-01", end_date: "2026-06-30", weekly_rent: 650 },
];

describe("accruedRentForFy", () => {
  it("treats a full year as 52 weeks", () => {
    // Annual rent is conventionally 52 x weekly, so the span is measured
    // exclusively. An inclusive count would give 52.14 weeks and quietly
    // inflate every full-year figure.
    expect(accruedRentForFy(fullYearTenancy, FY)).toBe(52 * 650);
  });

  it("clamps a tenancy that began before the year", () => {
    const periods = [
      { start_date: "2020-01-01", end_date: "2026-06-30", weekly_rent: 700 },
    ];
    expect(accruedRentForFy(periods, FY)).toBe(52 * 700);
  });

  it("treats an open-ended tenancy as running to year end", () => {
    const periods = [
      { start_date: "2025-07-01", end_date: null, weekly_rent: 500 },
    ];
    expect(accruedRentForFy(periods, FY)).toBe(52 * 500);
  });

  it("accrues only the part of a tenancy inside the year", () => {
    // 1 Jan 2026 to 30 Jun 2026 is 180 days -> 180/7 weeks.
    const periods = [
      { start_date: "2026-01-01", end_date: "2026-06-30", weekly_rent: 700 },
    ];
    expect(accruedRentForFy(periods, FY)).toBeCloseTo((180 / 7) * 700, 6);
  });

  it("ignores tenancies entirely outside the year", () => {
    const periods = [
      { start_date: "2019-01-01", end_date: "2019-12-31", weekly_rent: 400 },
    ];
    expect(accruedRentForFy(periods, FY)).toBe(0);
  });

  it("sums several tenancies at different rents", () => {
    const periods = [
      { start_date: "2025-07-01", end_date: "2025-12-31", weekly_rent: 600 },
      { start_date: "2026-01-01", end_date: "2026-06-30", weekly_rent: 700 },
    ];
    const expected = (183 / 7) * 600 + (180 / 7) * 700;
    expect(accruedRentForFy(periods, FY)).toBeCloseTo(expected, 6);
  });

  it("returns null when there are no tenancies at all", () => {
    expect(accruedRentForFy([], FY)).toBeNull();
  });
});

describe("actualRentForFy", () => {
  it("sums payments dated inside the year", () => {
    const payments = [
      { payment_date: "2025-08-01", amount: 2600 },
      { payment_date: "2026-05-01", amount: 2600 },
    ];
    expect(actualRentForFy(payments, FY)).toBe(5200);
  });

  it("excludes payments outside the year", () => {
    const payments = [
      { payment_date: "2025-06-30", amount: 1000 }, // prior year
      { payment_date: "2025-07-01", amount: 2000 }, // first day, included
      { payment_date: "2026-06-30", amount: 3000 }, // last day, included
      { payment_date: "2026-07-01", amount: 4000 }, // next year
    ];
    expect(actualRentForFy(payments, FY)).toBe(5000);
  });

  it("returns null when no payments have been recorded at all", () => {
    // Distinct from zero: no records means unknown, not "no rent received".
    expect(actualRentForFy([], FY)).toBeNull();
  });

  it("returns 0 when payments exist but none fall in the year", () => {
    const payments = [{ payment_date: "2020-01-01", amount: 500 }];
    expect(actualRentForFy(payments, FY)).toBe(0);
  });
});

describe("resolveRentalIncome", () => {
  it("prefers actual payments and says so", () => {
    const payments = [{ payment_date: "2025-08-01", amount: 33_800 }];
    const r = resolveRentalIncome(payments, fullYearTenancy, FY);
    expect(r.source).toBe("actual");
    expect(r.amount).toBe(33_800);
    expect(r.accrued).toBe(33_800);
  });

  it("falls back to the accrual when no payments are recorded", () => {
    const r = resolveRentalIncome([], fullYearTenancy, FY);
    expect(r.source).toBe("accrued");
    expect(r.amount).toBe(52 * 650);
    expect(r.actual).toBeNull();
  });

  it("reports no income when neither source has data", () => {
    const r = resolveRentalIncome([], [], FY);
    expect(r.source).toBeNull();
    expect(r.amount).toBeNull();
  });

  it("carries both figures as a cross-check when both exist", () => {
    const payments = [{ payment_date: "2025-08-01", amount: 30_000 }];
    const r = resolveRentalIncome(payments, fullYearTenancy, FY);
    expect(r.actual).toBe(30_000);
    expect(r.accrued).toBe(33_800);
    expect(r.divergence).not.toBeNull();
  });

  it("does not flag a timing difference of about one week", () => {
    // Rent paid in advance or arrears straddles 30 June. That is normal and
    // must not produce a warning, or the warning becomes noise.
    const payments = [{ payment_date: "2025-08-01", amount: 33_800 - 650 }];
    const r = resolveRentalIncome(payments, fullYearTenancy, FY);
    expect(r.materialDivergence).toBe(false);
  });

  it("flags a missing month of rent", () => {
    // ~4.3 weeks missing is 8% of the year — a data gap, not timing.
    const payments = [{ payment_date: "2025-08-01", amount: 33_800 - 2_817 }];
    const r = resolveRentalIncome(payments, fullYearTenancy, FY);
    expect(r.materialDivergence).toBe(true);
  });

  it("does not flag a large percentage on a trivial amount", () => {
    // 50% off $200 is proportionally huge but immaterial in dollars.
    const periods = [
      { start_date: "2026-06-24", end_date: "2026-06-30", weekly_rent: 200 },
    ];
    const payments = [{ payment_date: "2026-06-25", amount: 100 }];
    const r = resolveRentalIncome(payments, periods, FY);
    expect(r.materialDivergence).toBe(false);
  });

  it("flags when actual materially exceeds accrued", () => {
    // Divergence is symmetric: unexpectedly high receipts matter too.
    const payments = [{ payment_date: "2025-08-01", amount: 40_000 }];
    const r = resolveRentalIncome(payments, fullYearTenancy, FY);
    expect(r.materialDivergence).toBe(true);
    expect(r.divergence!.absolute).toBeCloseTo(40_000 - 33_800, 6);
  });

  it("never flags divergence when only one source exists", () => {
    expect(resolveRentalIncome([], fullYearTenancy, FY).materialDivergence).toBe(
      false,
    );
    const payments = [{ payment_date: "2025-08-01", amount: 1 }];
    expect(resolveRentalIncome(payments, [], FY).materialDivergence).toBe(false);
  });

  it("exposes its thresholds so the UI can explain them", () => {
    expect(MATERIAL_DIVERGENCE_PCT).toBeGreaterThan(0);
    expect(MATERIAL_DIVERGENCE_MIN_ABSOLUTE).toBeGreaterThan(0);
  });
});
