import { afterEach, describe, expect, it } from "vitest";
import {
  UNDATED_LABEL,
  groupByFinancialYear,
} from "@/lib/tax/fy-grouping";

/**
 * Minimal stand-in for the rows this module groups. The real callers pass
 * RentalPayment and RentalOperatingExpense; the module only ever sees the date
 * the accessor returns, so a bare shape is enough and keeps the tests focused.
 */
interface Row {
  id: string;
  date: string | null | undefined;
}

const rows = (...specs: Array<[string, string | null | undefined]>): Row[] =>
  specs.map(([id, date]) => ({ id, date }));

const byDate = (row: Row) => row.date;

/** Ids in output order, flattened across groups — the reconciliation check. */
const idsOf = (groups: Array<{ items: Row[] }>) =>
  groups.flatMap((g) => g.items.map((i) => i.id));

describe("groupByFinancialYear", () => {
  it("returns no groups for an empty list", () => {
    expect(groupByFinancialYear([], byDate)).toEqual([]);
  });

  it("returns a single group carrying the financial year and its label", () => {
    const groups = groupByFinancialYear(
      rows(["a", "2025-09-07"]),
      byDate,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].fyEndYear).toBe(2026);
    expect(groups[0].label).toBe("2025–26");
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
  });

  describe("financial year boundary", () => {
    it("places 30 June in the year that is ending", () => {
      const [group] = groupByFinancialYear(rows(["a", "2025-06-30"]), byDate);
      expect(group.fyEndYear).toBe(2025);
      expect(group.label).toBe("2024–25");
    });

    it("places 1 July in the year that is beginning", () => {
      const [group] = groupByFinancialYear(rows(["a", "2025-07-01"]), byDate);
      expect(group.fyEndYear).toBe(2026);
      expect(group.label).toBe("2025–26");
    });

    it("separates two rows one day apart across the boundary", () => {
      const groups = groupByFinancialYear(
        rows(["jul", "2025-07-01"], ["jun", "2025-06-30"]),
        byDate,
      );

      expect(groups.map((g) => g.fyEndYear)).toEqual([2026, 2025]);
      expect(groups[0].items.map((i) => i.id)).toEqual(["jul"]);
      expect(groups[1].items.map((i) => i.id)).toEqual(["jun"]);
    });
  });

  it("orders groups newest financial year first", () => {
    const groups = groupByFinancialYear(
      rows(
        ["old", "2023-08-01"],
        ["new", "2025-08-01"],
        ["mid", "2024-08-01"],
      ),
      byDate,
    );

    expect(groups.map((g) => g.fyEndYear)).toEqual([2026, 2025, 2024]);
    expect(groups.map((g) => g.label)).toEqual([
      "2025–26",
      "2024–25",
      "2023–24",
    ]);
  });

  it("preserves the caller's order within a group and does not sort", () => {
    // Deliberately jumbled within one financial year. Both call sites already
    // sort by date descending, so re-sorting here would silently override the
    // order the UI intends to render.
    const groups = groupByFinancialYear(
      rows(
        ["b", "2025-09-01"],
        ["d", "2026-01-15"],
        ["a", "2025-12-25"],
        ["c", "2025-07-02"],
      ),
      byDate,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("honours a non-July financial year start", () => {
    // A 1 April start: 31 March closes the year, 1 April opens the next.
    const groups = groupByFinancialYear(
      rows(["after", "2025-04-01"], ["before", "2025-03-31"]),
      byDate,
      4,
      1,
    );

    expect(groups.map((g) => g.fyEndYear)).toEqual([2026, 2025]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["after"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["before"]);
  });

  it("labels a calendar-aligned financial year as a single year", () => {
    const [group] = groupByFinancialYear(
      rows(["a", "2025-06-15"]),
      byDate,
      1,
      1,
    );

    expect(group.fyEndYear).toBe(2025);
    expect(group.label).toBe("2025");
  });

  it("groups 29 February without assuming a fixed month length", () => {
    const [group] = groupByFinancialYear(rows(["a", "2024-02-29"]), byDate);
    expect(group.fyEndYear).toBe(2024);
    expect(group.label).toBe("2023–24");
  });

  describe("rows without a usable date", () => {
    it("collects null, undefined and malformed dates into one Undated group", () => {
      const groups = groupByFinancialYear(
        rows(
          ["nil", null],
          ["undef", undefined],
          ["empty", ""],
          ["junk", "not-a-date"],
          ["impossible", "2025-13-45"],
        ),
        byDate,
      );

      expect(groups).toHaveLength(1);
      expect(groups[0].fyEndYear).toBeNull();
      expect(groups[0].label).toBe(UNDATED_LABEL);
      expect(groups[0].items.map((i) => i.id)).toEqual([
        "nil",
        "undef",
        "empty",
        "junk",
        "impossible",
      ]);
    });

    it("sorts the Undated group last, after every dated year", () => {
      const groups = groupByFinancialYear(
        rows(["bad", null], ["new", "2025-08-01"], ["old", "2023-08-01"]),
        byDate,
      );

      expect(groups.map((g) => g.label)).toEqual([
        "2025–26",
        "2023–24",
        UNDATED_LABEL,
      ]);
    });

    it("never drops a row, so subtotals reconcile with the whole-of-list total", () => {
      const input = rows(
        ["a", "2025-08-01"],
        ["b", null],
        ["c", "2024-08-01"],
        ["d", "junk"],
        ["e", "2025-09-01"],
      );

      const groups = groupByFinancialYear(input, byDate);

      expect(idsOf(groups).sort()).toEqual(["a", "b", "c", "d", "e"]);
    });
  });

  describe("timezone independence", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    // Parsing "2025-07-01" with the local-time Date constructor yields
    // 2025-06-30T14:00:00Z in Sydney, which files the row under the previous
    // financial year. Grouping must be identical in every zone.
    it("groups a 1 July date identically in Australia/Sydney and UTC", () => {
      process.env.TZ = "Australia/Sydney";
      const sydney = groupByFinancialYear(rows(["a", "2025-07-01"]), byDate);

      process.env.TZ = "UTC";
      const utc = groupByFinancialYear(rows(["a", "2025-07-01"]), byDate);

      expect(sydney[0].fyEndYear).toBe(2026);
      expect(utc[0].fyEndYear).toBe(2026);
      expect(sydney).toEqual(utc);
    });

    it("keeps the 30 June boundary stable in Australia/Sydney", () => {
      process.env.TZ = "Australia/Sydney";
      const [group] = groupByFinancialYear(rows(["a", "2025-06-30"]), byDate);
      expect(group.fyEndYear).toBe(2025);
    });
  });
});
