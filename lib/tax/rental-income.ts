/**
 * Rental income for a financial year, from two independent sources.
 *
 * `rental_payments` holds what was actually received — ingested from agent
 * statements via the inbound email webhook. `rental_periods` holds the tenancy
 * terms, from which income can be accrued. Actuals are what a return is built
 * on; the accrual is a cross-check that catches missing data.
 *
 * The two are never silently reconciled. Where they disagree materially the
 * caller is told, because the usual cause is a gap in the payment records
 * rather than an error in either figure.
 */
import { AU_FY_START_DAY, AU_FY_START_MONTH, fyBounds } from "@/lib/tax/fy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Relative gap at which actual and accrued are worth investigating.
 *
 * A month of missing rent is roughly 8% of a year, so 5% catches it. Rent paid
 * a week either side of 30 June is about 2%, and must not trigger — a warning
 * that fires on normal timing differences is a warning people learn to ignore.
 */
export const MATERIAL_DIVERGENCE_PCT = 0.05;

/**
 * Dollar floor below which a percentage gap is not worth raising. Guards
 * against a large relative difference on a trivial amount, such as a tenancy
 * that ran for only a few days.
 */
export const MATERIAL_DIVERGENCE_MIN_ABSOLUTE = 500;

export interface TenancyPeriod {
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
}

export interface RentalPaymentInput {
  payment_date: string;
  amount: number;
}

export type RentalIncomeSource = "actual" | "accrued";

export interface RentalIncomeResolution {
  /** The figure to report, or null when neither source has data. */
  amount: number | null;
  /** Which source `amount` came from. */
  source: RentalIncomeSource | null;
  /** Sum of recorded payments in the year; null when none are recorded. */
  actual: number | null;
  /** Accrued from tenancy terms; null when no tenancy is recorded. */
  accrued: number | null;
  /** Present only when both sources produced a figure. */
  divergence: { absolute: number; pct: number } | null;
  /** True when the divergence exceeds both thresholds above. */
  materialDivergence: boolean;
}

function fyRange(
  fyEndYear: number,
  startMonth: number,
  startDay: number,
): { start: number; end: number } {
  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);
  return {
    start: Date.parse(`${startDate}T00:00:00Z`),
    end: Date.parse(`${endDate}T00:00:00Z`),
  };
}

/**
 * Rent accrued from tenancy terms within the year.
 *
 * The span is measured exclusively, so a full year is 52 weeks rather than
 * 52.14. Annual rent is conventionally 52 x the weekly figure, and an
 * inclusive count would inflate every full-year accrual by a fifth of a week.
 *
 * Returns null when no tenancy is recorded — distinct from 0, which means
 * tenancies exist but none fell inside the year.
 */
export function accruedRentForFy(
  periods: ReadonlyArray<TenancyPeriod>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number | null {
  if (periods.length === 0) return null;
  const { start: fyStart, end: fyEnd } = fyRange(fyEndYear, startMonth, startDay);

  let total = 0;
  for (const period of periods) {
    const rawStart = Date.parse(`${period.start_date}T00:00:00Z`);
    const rawEnd = period.end_date
      ? Date.parse(`${period.end_date}T00:00:00Z`)
      : fyEnd;
    if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) continue;

    const start = Math.max(rawStart, fyStart);
    const end = Math.min(rawEnd, fyEnd);
    if (end <= start) continue;

    total += ((end - start) / MS_PER_WEEK) * period.weekly_rent;
  }
  return total;
}

/**
 * Payments actually received within the year.
 *
 * Returns null when no payments are recorded at all — that means unknown, not
 * "no rent received", and the caller must not report it as zero income.
 */
export function actualRentForFy(
  payments: ReadonlyArray<RentalPaymentInput>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number | null {
  if (payments.length === 0) return null;
  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);

  let total = 0;
  for (const payment of payments) {
    // Dates are `yyyy-mm-dd`, so lexical comparison is chronological and
    // avoids constructing a Date per row.
    if (payment.payment_date < startDate || payment.payment_date > endDate) {
      continue;
    }
    total += Number(payment.amount);
  }
  return total;
}

/**
 * Resolve the income figure to report, preferring recorded payments and
 * falling back to the accrual, always disclosing which was used.
 */
export function resolveRentalIncome(
  payments: ReadonlyArray<RentalPaymentInput>,
  periods: ReadonlyArray<TenancyPeriod>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): RentalIncomeResolution {
  const actual = actualRentForFy(payments, fyEndYear, startMonth, startDay);
  const accrued = accruedRentForFy(periods, fyEndYear, startMonth, startDay);

  const source: RentalIncomeSource | null =
    actual != null ? "actual" : accrued != null ? "accrued" : null;
  const amount = actual ?? accrued ?? null;

  let divergence: RentalIncomeResolution["divergence"] = null;
  let materialDivergence = false;

  if (actual != null && accrued != null) {
    const absolute = actual - accrued;
    // Guard the denominator so a zero accrual cannot produce Infinity.
    const pct = accrued === 0 ? 0 : absolute / accrued;
    divergence = { absolute, pct };
    materialDivergence =
      Math.abs(pct) > MATERIAL_DIVERGENCE_PCT &&
      Math.abs(absolute) >= MATERIAL_DIVERGENCE_MIN_ABSOLUTE;
  }

  return { amount, source, actual, accrued, divergence, materialDivergence };
}
