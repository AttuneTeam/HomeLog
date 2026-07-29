/**
 * Financial-year arithmetic.
 *
 * Every calculation here is done in UTC. This is deliberate: constructing dates
 * with the local-time `Date` constructor and then serialising with
 * `toISOString()` shifts the result back a day in any positive-offset timezone.
 * In Australia (UTC+10/+11) `new Date(2025, 6, 1).toISOString()` yields
 * "2025-06-30", which silently pulls an extra day of expenses into the previous
 * financial year. Keeping the whole pipeline in UTC avoids that class of bug.
 *
 * A financial year is identified by `fyEndYear` — the calendar year in which it
 * ends. The Australian FY running 1 July 2025 to 30 June 2026 has an
 * `fyEndYear` of 2026 and is labelled "2025–26".
 */

/** Australian default: the financial year starts on 1 July. */
export const AU_FY_START_MONTH = 7;
export const AU_FY_START_DAY = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FinancialYear {
  /** Calendar year in which the financial year ends. */
  fyEndYear: number;
  /** Inclusive first day, as `yyyy-mm-dd`. */
  startDate: string;
  /** Inclusive last day, as `yyyy-mm-dd`. */
  endDate: string;
  /** Display label, e.g. "2025–26". */
  label: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * True when the financial year occupies a single calendar year, which happens
 * only when it starts on 1 January. Everything else spans a year boundary, so
 * the year it starts in is one before the year it ends in.
 */
function isCalendarYear(startMonth: number, startDay: number): boolean {
  return startMonth === 1 && startDay === 1;
}

function startYearFor(
  fyEndYear: number,
  startMonth: number,
  startDay: number,
): number {
  return isCalendarYear(startMonth, startDay) ? fyEndYear : fyEndYear - 1;
}

/**
 * Inclusive bounds of the financial year ending in `fyEndYear`.
 *
 * The end date is derived as "the day before the next year begins" rather than
 * by assuming a fixed month length, so 29 February is handled correctly.
 */
export function fyBounds(
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): FinancialYear {
  const startYear = startYearFor(fyEndYear, startMonth, startDay);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const nextStart = new Date(Date.UTC(startYear + 1, startMonth - 1, startDay));
  const end = new Date(nextStart.getTime() - MS_PER_DAY);

  return {
    fyEndYear,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    label: formatFyLabel(fyEndYear, startMonth, startDay),
  };
}

/**
 * The financial year `today` falls inside, identified by the year it ends in.
 *
 * `today` is read via its UTC components, so callers should pass a date whose
 * UTC calendar day is the intended one.
 */
export function currentFyEndYear(
  today: Date,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number {
  const year = today.getUTCFullYear();
  const boundary = Date.UTC(year, startMonth - 1, startDay);
  const todayUtc = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());

  const startYear = todayUtc >= boundary ? year : year - 1;
  return isCalendarYear(startMonth, startDay) ? startYear : startYear + 1;
}

/**
 * The most recent financial year that has actually finished.
 *
 * This is the year a tax return is being prepared for, and the correct default
 * for any tax-reporting surface. Deriving the year from `today` alone returns
 * the *in-progress* year — on 29 July 2026 that is 2026–27, not the 2025–26
 * year the return covers.
 *
 * A year is not complete until the day after it ends: on 30 June 2026 the
 * 2025–26 year is still running.
 */
export function mostRecentCompletedFyEndYear(
  today: Date,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number {
  return currentFyEndYear(today, startMonth, startDay) - 1;
}

/**
 * Display label for a financial year, e.g. "2025–26" (en dash, per the product
 * guidelines). A financial year aligned to the calendar renders as a single
 * year.
 */
export function formatFyLabel(
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): string {
  if (isCalendarYear(startMonth, startDay)) return String(fyEndYear);
  const secondHalf = String(fyEndYear % 100).padStart(2, "0");
  return `${fyEndYear - 1}–${secondHalf}`;
}

/**
 * Completed financial years available for selection, newest first.
 *
 * The in-progress year is excluded: a partial year cannot produce a meaningful
 * tax report, and offering it is what makes the wrong year easy to pick.
 */
export function selectableFyEndYears(
  today: Date,
  count: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number[] {
  if (count <= 0) return [];
  const latest = mostRecentCompletedFyEndYear(today, startMonth, startDay);
  return Array.from({ length: count }, (_, i) => latest - i);
}
