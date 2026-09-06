/**
 * Grouping arbitrary dated records into financial years.
 *
 * This exists so a list of payments or expenses can be rendered under
 * financial-year headings without every call site re-deriving the boundary.
 * All the calendar arithmetic is delegated to `./fy`; nothing here computes a
 * date, it only decides which bucket a record falls into.
 *
 * Dates are parsed as UTC, for the reason documented at the top of `./fy`:
 * `new Date("2025-07-01")` parsed as local time is 2025-06-30T14:00Z in
 * Australia, which files the first day of a financial year under the previous
 * one. Every parse here goes through an explicit `Z`.
 */

import {
  AU_FY_START_DAY,
  AU_FY_START_MONTH,
  currentFyEndYear,
  formatFyLabel,
} from "./fy";

/** Heading for records whose date is missing or unreadable. */
export const UNDATED_LABEL = "Undated";

/** `yyyy-mm-dd`. Well-formed shape only — 2025-13-45 matches and is rejected later. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface FinancialYearGroup<T> {
  /**
   * Calendar year the financial year ends in, or null for the undated group.
   */
  fyEndYear: number | null;
  /** Display label, e.g. "2025–26", or `UNDATED_LABEL`. */
  label: string;
  /** Records in this year, in the order the caller supplied them. */
  items: T[];
}

/**
 * The financial year a date falls into, or null when there isn't one to
 * determine.
 *
 * Accepts a full ISO timestamp as well as a plain date by taking the leading
 * UTC calendar day, so a column that later gains a time component does not
 * silently start reporting every row as undated.
 */
function fyEndYearForDate(
  date: string | null | undefined,
  startMonth: number,
  startDay: number,
): number | null {
  if (!date) return null;

  const day = date.slice(0, 10);
  if (!DATE_ONLY.test(day)) return null;

  // Catches dates that are well-shaped but not real, such as 2025-02-30.
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;

  return currentFyEndYear(new Date(parsed), startMonth, startDay);
}

/**
 * Group records by the financial year their date falls into, newest year first.
 *
 * Order within a group is the caller's order, untouched. Callers already sort
 * for display — usually by date descending — and re-sorting here would quietly
 * override the order the interface intends to render.
 *
 * Records with no usable date are never dropped. They collect into a single
 * trailing group so that per-year subtotals still add up to the whole-of-list
 * total shown alongside them; a silently discarded row would make those two
 * figures disagree, which is worse than an "Undated" heading.
 *
 * @param getDate Reads the record's date as `yyyy-mm-dd`.
 * @param startMonth 1-based month the financial year starts in.
 * @param startDay Day of that month the financial year starts on.
 */
export function groupByFinancialYear<T>(
  items: readonly T[],
  getDate: (item: T) => string | null | undefined,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): FinancialYearGroup<T>[] {
  const byYear = new Map<number, T[]>();
  const undated: T[] = [];

  for (const item of items) {
    const fyEndYear = fyEndYearForDate(getDate(item), startMonth, startDay);

    if (fyEndYear === null) {
      undated.push(item);
      continue;
    }

    const bucket = byYear.get(fyEndYear);
    if (bucket) {
      bucket.push(item);
    } else {
      byYear.set(fyEndYear, [item]);
    }
  }

  const groups: FinancialYearGroup<T>[] = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([fyEndYear, groupItems]) => ({
      fyEndYear,
      label: formatFyLabel(fyEndYear, startMonth, startDay),
      items: groupItems,
    }));

  if (undated.length > 0) {
    groups.push({ fyEndYear: null, label: UNDATED_LABEL, items: undated });
  }

  return groups;
}
