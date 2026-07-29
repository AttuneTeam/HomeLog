import { describe, expect, it } from "vitest";
import { div43RegisterForFy } from "@/lib/tax/div43";

const item = (over: Partial<Parameters<typeof div43RegisterForFy>[0][number]> = {}) => ({
  id: "a",
  amount: 100_000,
  startDate: "2020-07-01",
  ratePct: 2.5,
  description: "Bathroom",
  ...over,
});

describe("div43RegisterForFy", () => {
  it("claims the full annual rate for a complete year", () => {
    const r = div43RegisterForFy([item()], 2026);
    expect(r.items[0].claimThisYear).toBeCloseTo(2_500, 6);
    expect(r.totalClaim).toBeCloseTo(2_500, 6);
  });

  it("accumulates prior years and writes the balance down", () => {
    // Completed 1 Jul 2020, so FY2021 through FY2026 is six full years.
    const r = div43RegisterForFy([item()], 2026);
    expect(r.items[0].yearsClaimed).toBe(6);
    expect(r.items[0].cumulativeClaimed).toBeCloseTo(15_000, 6);
    expect(r.items[0].writtenDownValue).toBeCloseTo(85_000, 6);
  });

  it("prorates the first year by days", () => {
    // Completed 22 Nov 2025: 221 days of FY2025–26.
    const r = div43RegisterForFy([item({ startDate: "2025-11-22" })], 2026);
    expect(r.items[0].daysOnFoot).toBe(221);
    expect(r.items[0].claimThisYear).toBeCloseTo(
      100_000 * 0.025 * (221 / 365),
      6,
    );
    expect(r.items[0].yearsClaimed).toBe(1);
  });

  it("claims nothing before the works were completed", () => {
    const r = div43RegisterForFy([item({ startDate: "2026-11-01" })], 2026);
    expect(r.items[0].claimThisYear).toBe(0);
    expect(r.items[0].daysOnFoot).toBe(0);
    expect(r.items[0].cumulativeClaimed).toBe(0);
    expect(r.items[0].writtenDownValue).toBeCloseTo(100_000, 6);
  });

  it("claims nothing once the 40-year life has run out", () => {
    const r = div43RegisterForFy([item({ startDate: "1980-01-01" })], 2026);
    expect(r.items[0].claimThisYear).toBe(0);
    expect(r.items[0].fullyWrittenOff).toBe(true);
    expect(r.items[0].writtenDownValue).toBeCloseTo(0, 6);
  });

  it("never claims more than the original amount in total", () => {
    // A year inside the final stretch of the 40-year life.
    const r = div43RegisterForFy([item({ startDate: "1987-07-01" })], 2026);
    expect(r.items[0].cumulativeClaimed).toBeLessThanOrEqual(100_000 + 1e-6);
    expect(r.items[0].writtenDownValue).toBeGreaterThanOrEqual(-1e-6);
  });

  it("uses a 25-year life at a 4% rate", () => {
    const fourPct = item({ ratePct: 4, startDate: "2000-07-01" });
    // 26 years after completion, a 4% item is fully written off.
    const r = div43RegisterForFy([fourPct], 2026);
    expect(r.items[0].claimThisYear).toBe(0);
    expect(r.items[0].fullyWrittenOff).toBe(true);
  });

  it("claims 4% in a full year while the item is live", () => {
    const r = div43RegisterForFy(
      [item({ ratePct: 4, startDate: "2020-07-01" })],
      2026,
    );
    expect(r.items[0].claimThisYear).toBeCloseTo(4_000, 6);
  });

  it("tracks several items on their own clocks", () => {
    const r = div43RegisterForFy(
      [
        item({ id: "bathroom", startDate: "2019-11-30", amount: 18_000 }),
        item({ id: "deck", startDate: "2025-11-22", amount: 12_000 }),
      ],
      2026,
    );
    const bathroom = r.items.find((i) => i.id === "bathroom")!;
    const deck = r.items.find((i) => i.id === "deck")!;

    expect(bathroom.claimThisYear).toBeCloseTo(18_000 * 0.025, 6);
    expect(deck.claimThisYear).toBeCloseTo(12_000 * 0.025 * (221 / 365), 6);
    // A single property-level figure could not represent both.
    expect(bathroom.yearsClaimed).toBeGreaterThan(deck.yearsClaimed);
    expect(r.totalClaim).toBeCloseTo(
      bathroom.claimThisYear + deck.claimThisYear,
      6,
    );
  });

  it("includes 29 February in a leap financial year", () => {
    const r = div43RegisterForFy([item({ startDate: "2020-07-01" })], 2024);
    expect(r.items[0].daysOnFoot).toBe(366);
    // A full year still claims exactly the annual rate, leap or not.
    expect(r.items[0].claimThisYear).toBeCloseTo(2_500, 6);
  });

  it("returns empty totals for no items", () => {
    const r = div43RegisterForFy([], 2026);
    expect(r.items).toEqual([]);
    expect(r.totalClaim).toBe(0);
    expect(r.totalWrittenDownValue).toBe(0);
  });

  it("ignores an item with no completion date recorded", () => {
    // Without a start date the clock cannot be established, so nothing is
    // claimed rather than a date being guessed.
    const r = div43RegisterForFy([item({ startDate: null })], 2026);
    expect(r.items[0].claimThisYear).toBe(0);
    expect(r.items[0].missingStartDate).toBe(true);
    expect(r.totalClaim).toBe(0);
  });
});
