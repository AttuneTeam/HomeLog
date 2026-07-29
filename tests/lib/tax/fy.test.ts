import { describe, expect, it } from "vitest";
import {
  currentFyEndYear,
  daysInFy,
  formatFyLabel,
  fyBounds,
  mostRecentCompletedFyEndYear,
  resolveFyEndYear,
  selectableFyEndYears,
} from "@/lib/tax/fy";

// All dates are constructed with Date.UTC so these assertions are independent
// of the machine's timezone. The helper itself must also work in UTC: building
// bounds with local-time Date constructors and then calling toISOString() shifts
// the date backwards a day in any positive-offset zone (e.g. Australia), which
// is precisely the defect this helper replaces.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("fyBounds", () => {
  it("returns the Australian default 1 July – 30 June year", () => {
    expect(fyBounds(2026)).toEqual({
      fyEndYear: 2026,
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      label: "2025–26",
    });
  });

  it("handles an earlier financial year", () => {
    const fy = fyBounds(2024);
    expect(fy.startDate).toBe("2023-07-01");
    expect(fy.endDate).toBe("2024-06-30");
    expect(fy.label).toBe("2023–24");
  });

  it("ends on 29 February when the financial year closes in a leap year", () => {
    // A 1 March start means the year ends on the last day of February.
    const fy = fyBounds(2024, 3, 1);
    expect(fy.startDate).toBe("2023-03-01");
    expect(fy.endDate).toBe("2024-02-29");
  });

  it("ends on 28 February in a non-leap year", () => {
    const fy = fyBounds(2023, 3, 1);
    expect(fy.startDate).toBe("2022-03-01");
    expect(fy.endDate).toBe("2023-02-28");
  });

  it("treats a 1 January start as a single calendar year", () => {
    const fy = fyBounds(2025, 1, 1);
    expect(fy.startDate).toBe("2025-01-01");
    expect(fy.endDate).toBe("2025-12-31");
    expect(fy.label).toBe("2025");
  });

  it("produces bounds that are inclusive and exactly one year apart", () => {
    const fy = fyBounds(2026);
    // Inclusive bounds: the day after endDate is the next year's startDate.
    expect(fyBounds(2027).startDate).toBe("2026-07-01");
    expect(fy.endDate).toBe("2026-06-30");
  });
});

describe("currentFyEndYear", () => {
  it("treats 30 June as still inside the closing financial year", () => {
    expect(currentFyEndYear(utc(2026, 6, 30))).toBe(2026);
  });

  it("rolls over on 1 July", () => {
    expect(currentFyEndYear(utc(2026, 7, 1))).toBe(2027);
  });

  it("reports the current year for a mid-year date", () => {
    expect(currentFyEndYear(utc(2026, 5, 15))).toBe(2026);
  });

  it("honours a custom financial year start", () => {
    // With a 1 April start, 31 March 2026 is still the year ending 2026.
    expect(currentFyEndYear(utc(2026, 3, 31), 4, 1)).toBe(2026);
    expect(currentFyEndYear(utc(2026, 4, 1), 4, 1)).toBe(2027);
  });
});

describe("mostRecentCompletedFyEndYear", () => {
  it("returns the year just ended when today is in the new financial year", () => {
    // 29 July 2026: FY2025–26 closed on 30 June 2026 and is the year a
    // 2026 return is prepared for. Deriving the FY from "today" instead
    // returns 2026–27, which is the bug this helper exists to prevent.
    expect(mostRecentCompletedFyEndYear(utc(2026, 7, 29))).toBe(2026);
  });

  it("does not count the year that ends today", () => {
    // On 30 June 2026 the financial year has not finished yet.
    expect(mostRecentCompletedFyEndYear(utc(2026, 6, 30))).toBe(2025);
  });

  it("counts it from the following day", () => {
    expect(mostRecentCompletedFyEndYear(utc(2026, 7, 1))).toBe(2026);
  });

  it("honours a custom financial year start", () => {
    expect(mostRecentCompletedFyEndYear(utc(2026, 4, 1), 4, 1)).toBe(2026);
    expect(mostRecentCompletedFyEndYear(utc(2026, 3, 31), 4, 1)).toBe(2025);
  });
});

describe("formatFyLabel", () => {
  it("renders a spanning year with an en dash", () => {
    expect(formatFyLabel(2026)).toBe("2025–26");
  });

  it("pads the second half of the label", () => {
    expect(formatFyLabel(2030)).toBe("2029–30");
    expect(formatFyLabel(2001)).toBe("2000–01");
  });

  it("renders a calendar financial year as a single year", () => {
    expect(formatFyLabel(2025, 1, 1)).toBe("2025");
  });
});

describe("selectableFyEndYears", () => {
  it("lists completed years newest first", () => {
    expect(selectableFyEndYears(utc(2026, 7, 29), 4)).toEqual([
      2026, 2025, 2024, 2023,
    ]);
  });

  it("excludes the in-progress year", () => {
    const years = selectableFyEndYears(utc(2026, 6, 30), 3);
    expect(years).toEqual([2025, 2024, 2023]);
    expect(years).not.toContain(2026);
  });

  it("returns an empty list when asked for none", () => {
    expect(selectableFyEndYears(utc(2026, 7, 29), 0)).toEqual([]);
  });
});

describe("daysInFy", () => {
  it("counts an ordinary Australian financial year as 365 days", () => {
    expect(daysInFy(2026)).toBe(365);
  });

  it("counts 366 when the year contains 29 February", () => {
    // 1 Jul 2023 – 30 Jun 2024 spans February 2024, a leap month.
    expect(daysInFy(2024)).toBe(366);
  });

  it("counts a calendar financial year correctly", () => {
    expect(daysInFy(2025, 1, 1)).toBe(365);
    expect(daysInFy(2024, 1, 1)).toBe(366);
  });
});

describe("resolveFyEndYear", () => {
  const available = [2026, 2025, 2024, 2023];

  it("accepts a year that is on offer", () => {
    expect(resolveFyEndYear("2024", available)).toBe(2024);
    expect(resolveFyEndYear(2025, available)).toBe(2025);
  });

  it("defaults to the newest year when none is requested", () => {
    expect(resolveFyEndYear(undefined, available)).toBe(2026);
    expect(resolveFyEndYear(null, available)).toBe(2026);
  });

  it("falls back rather than erroring on malformed input", () => {
    expect(resolveFyEndYear("not-a-year", available)).toBe(2026);
    expect(resolveFyEndYear("2024.5", available)).toBe(2026);
    expect(resolveFyEndYear("", available)).toBe(2026);
  });

  it("rejects a year outside the offered range", () => {
    // A future year would otherwise produce a partial or empty report.
    expect(resolveFyEndYear("2099", available)).toBe(2026);
    expect(resolveFyEndYear("1999", available)).toBe(2026);
  });

  it("returns null when nothing is available", () => {
    expect(resolveFyEndYear("2026", [])).toBeNull();
  });
});

describe("selecting FY 2025–26", () => {
  // The acceptance criterion for this phase: in July 2026, the report must be
  // able to produce the year a 2026 return covers.
  it("is the default on 29 July 2026 and spans 1 Jul 2025 – 30 Jun 2026", () => {
    const available = selectableFyEndYears(utc(2026, 7, 29), 6);
    const selected = resolveFyEndYear(undefined, available);
    expect(selected).toBe(2026);

    const fy = fyBounds(selected as number);
    expect(fy.startDate).toBe("2025-07-01");
    expect(fy.endDate).toBe("2026-06-30");
    expect(fy.label).toBe("2025–26");
  });

  it("can still be reached explicitly from a later year", () => {
    const available = selectableFyEndYears(utc(2028, 9, 1), 6);
    expect(resolveFyEndYear("2026", available)).toBe(2026);
  });
});
