import { describe, expect, it } from "vitest";
import { estimateInterestForFy } from "@/lib/tax/loan-interest";

const FY = 2026; // 1 Jul 2025 – 30 Jun 2026, 365 days

describe("estimateInterestForFy", () => {
  it("returns null without a loan amount", () => {
    expect(
      estimateInterestForFy({ loanAmount: null, rates: [{ rate: 6, effective_date: "2020-01-01" }] }, FY),
    ).toBeNull();
  });

  it("returns null without any rate", () => {
    expect(estimateInterestForFy({ loanAmount: 500_000, rates: [] }, FY)).toBeNull();
  });

  it("charges a full year when the loan predates the year", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2020-01-01",
        rates: [{ rate: 6, effective_date: "2019-01-01" }],
      },
      FY,
    );
    expect(r!.interest).toBeCloseTo(30_000, 6);
    expect(r!.daysCharged).toBe(365);
  });

  it("prorates from a mid-year loan start", () => {
    // Drawn down 27 Oct 2025: 247 of 365 days remain in FY2025–26.
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2025-10-27",
        rates: [{ rate: 6, effective_date: "2025-10-27" }],
      },
      FY,
    );
    expect(r!.daysCharged).toBe(247);
    expect(r!.interest).toBeCloseTo(500_000 * 0.06 * (247 / 365), 6);
  });

  it("returns zero days when the loan starts after the year ends", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2026-08-01",
        rates: [{ rate: 6, effective_date: "2026-08-01" }],
      },
      FY,
    );
    expect(r!.daysCharged).toBe(0);
    expect(r!.interest).toBe(0);
  });

  it("nets the offset balance off the interest-bearing amount", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        offsetBalance: 100_000,
        startDate: "2020-01-01",
        rates: [{ rate: 6, effective_date: "2019-01-01" }],
      },
      FY,
    );
    // Interest is charged on 400,000, not 500,000.
    expect(r!.interest).toBeCloseTo(24_000, 6);
    expect(r!.interestBearingBalance).toBe(400_000);
  });

  it("never lets an offset larger than the loan produce negative interest", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 100_000,
        offsetBalance: 250_000,
        startDate: "2020-01-01",
        rates: [{ rate: 6, effective_date: "2019-01-01" }],
      },
      FY,
    );
    expect(r!.interest).toBe(0);
    expect(r!.interestBearingBalance).toBe(0);
  });

  it("segments the year when the rate changes partway through", () => {
    // 6% for the first half, 7% from 1 Jan 2026.
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2020-01-01",
        rates: [
          { rate: 6, effective_date: "2019-01-01" },
          { rate: 7, effective_date: "2026-01-01" },
        ],
      },
      FY,
    );
    const firstDays = 184; // 1 Jul 2025 – 31 Dec 2025
    const secondDays = 181; // 1 Jan 2026 – 30 Jun 2026
    expect(firstDays + secondDays).toBe(365);
    expect(r!.interest).toBeCloseTo(
      500_000 * 0.06 * (firstDays / 365) + 500_000 * 0.07 * (secondDays / 365),
      6,
    );
    expect(r!.rateSegments).toBe(2);
  });

  it("ignores rate changes that fall outside the charging window", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2026-01-01",
        rates: [
          { rate: 6, effective_date: "2019-01-01" },
          { rate: 7, effective_date: "2025-09-01" }, // before the loan started
        ],
      },
      FY,
    );
    // Only the 7% rate is in force once the loan begins.
    expect(r!.rateSegments).toBe(1);
    expect(r!.interest).toBeCloseTo(500_000 * 0.07 * (181 / 365), 6);
  });

  it("uses 366 days in a leap financial year", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 365_000,
        startDate: "2020-01-01",
        rates: [{ rate: 10, effective_date: "2019-01-01" }],
      },
      2024, // 1 Jul 2023 – 30 Jun 2024, contains 29 Feb
    );
    expect(r!.daysCharged).toBe(366);
    expect(r!.interest).toBeCloseTo(36_500, 6);
  });

  it("assumes a full year when no start date is recorded", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        rates: [{ rate: 6, effective_date: "2019-01-01" }],
      },
      FY,
    );
    expect(r!.daysCharged).toBe(365);
    expect(r!.assumedFullYear).toBe(true);
  });

  it("reports that the balance was assumed constant", () => {
    const r = estimateInterestForFy(
      {
        loanAmount: 500_000,
        startDate: "2020-01-01",
        rates: [{ rate: 6, effective_date: "2019-01-01" }],
      },
      FY,
    );
    // The estimate does not amortise; the caller has to disclose that.
    expect(r!.assumedConstantBalance).toBe(true);
  });
});
