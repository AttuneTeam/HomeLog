/**
 * Managing agent fees for a financial year, from two independent sources.
 *
 * Confirmed statement fees are what an agent actually charged. The
 * `rental_periods.management_fee_pct` calculation is an estimate that can only
 * ever reproduce a recurring percentage — it cannot produce a one-off letting
 * fee, a lease preparation fee, or a bank charge. On a real statement
 * (Rich & Oliva OWN10905) it recovered the $242 management fee and missed
 * $1,251.80 of other charges.
 *
 * The two are NEVER summed. The statement's management fee is exactly what the
 * percentage produces, so adding them double-counts it.
 *
 * Mirrors the shape of lib/tax/rental-income.ts deliberately: actual preferred,
 * estimate as a labelled fallback, both carried so the caller can show the
 * cross-check. A figure whose provenance is not disclosed is one nobody can
 * check.
 */
import { AU_FY_START_DAY, AU_FY_START_MONTH, fyBounds } from "@/lib/tax/fy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface AgentFeePayment {
  payment_date: string;
  /**
   * Commission-type charges. Feed the ATO "Property agent fees and commission"
   * line. GST-inclusive as they appear on the statement: residential rent is
   * input-taxed, so no GST credit is claimable and the inclusive figure is the
   * deductible one.
   */
  management_fees: number | null;
  letting_fees: number | null;
  lease_fees: number | null;
  /**
   * Bank and administrative charges. NOT commission — these feed the ATO
   * "Sundry rental expenses" line, which keeps the commission figure directly
   * comparable to the percentage estimate it replaces.
   */
  sundry_fees: number | null;
  /** Null until a human accepts the figures. Unconfirmed fees are not claimable. */
  fees_confirmed_at: string | null;
}

export interface AgentFeeTenancy {
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_fee_pct: number | null;
}

export type AgentFeeSource = "actual" | "estimated";

export interface ConfirmedAgentFees {
  /** management + letting + lease. */
  commission: number;
  sundries: number;
}

export interface AgentFeeResolution {
  /** The commission figure to report, already resolved from a source. */
  commission: number;
  /** The sundry figure to report. Always 0 for an estimate. */
  sundries: number;
  /** Which source the figures came from; null when neither has data. */
  source: AgentFeeSource | null;
  /** Confirmed actuals, or null when no confirmed statement fell in the year. */
  actual: ConfirmedAgentFees | null;
  /** The percentage estimate, or null when no tenancy states a percentage. */
  estimated: number | null;
  /** Payments in the year carrying fees that nobody has confirmed yet. */
  unconfirmedCount: number;
  /** Payments recorded in the year, confirmed or not. */
  paymentsInYear: number;
  paymentsWithConfirmedFees: number;
  /**
   * True when SOME but not all payments in the year have confirmed fees.
   *
   * A partial actual is genuine but incomplete, and it can be smaller than the
   * estimate — the real FY2026 case resolves to $1,619.20 from two statements
   * against a true $2,851.20 across seven. Preferring it silently would
   * understate the deduction with no indication why, so the caller must
   * disclose this rather than present the figure as complete.
   */
  partial: boolean;
}

function hasAnyFee(payment: AgentFeePayment): boolean {
  return (
    payment.management_fees != null ||
    payment.letting_fees != null ||
    payment.lease_fees != null ||
    payment.sundry_fees != null
  );
}

/**
 * Fees from confirmed statements inside the year.
 *
 * Returns null when no confirmed statement fell in the year — that means
 * unknown, not "the agent charged nothing", and the caller must not report it
 * as zero.
 */
export function confirmedAgentFeesForFy(
  payments: ReadonlyArray<AgentFeePayment>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): ConfirmedAgentFees | null {
  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);

  let commission = 0;
  let sundries = 0;
  let found = false;

  for (const payment of payments) {
    if (payment.fees_confirmed_at == null) continue;
    if (!hasAnyFee(payment)) continue;
    // Dates are `yyyy-mm-dd`, so lexical comparison is chronological.
    if (payment.payment_date < startDate || payment.payment_date > endDate) {
      continue;
    }
    found = true;
    commission +=
      Number(payment.management_fees ?? 0) +
      Number(payment.letting_fees ?? 0) +
      Number(payment.lease_fees ?? 0);
    sundries += Number(payment.sundry_fees ?? 0);
  }

  return found ? { commission, sundries } : null;
}

/**
 * Fees estimated from the tenancy's management percentage.
 *
 * The span is measured exclusively so a full year is 52 weeks, matching
 * accruedRentForFy — an inclusive count would inflate every full-year figure by
 * a fifth of a week.
 *
 * Returns null when no tenancy states a percentage. Commission only: a
 * percentage model cannot produce a bank charge or a one-off letting fee.
 */
export function estimatedAgentFeesForFy(
  tenancies: ReadonlyArray<AgentFeeTenancy>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): number | null {
  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);
  const fyStart = Date.parse(`${startDate}T00:00:00Z`);
  const fyEnd = Date.parse(`${endDate}T00:00:00Z`);

  let total = 0;
  let found = false;

  for (const tenancy of tenancies) {
    if (!tenancy.management_fee_pct) continue;
    const rawStart = Date.parse(`${tenancy.start_date}T00:00:00Z`);
    const rawEnd = tenancy.end_date
      ? Date.parse(`${tenancy.end_date}T00:00:00Z`)
      : fyEnd;
    if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) continue;

    const start = Math.max(rawStart, fyStart);
    const end = Math.min(rawEnd, fyEnd);
    if (end <= start) continue;

    found = true;
    const weeks = (end - start) / MS_PER_WEEK;
    total += weeks * tenancy.weekly_rent * (tenancy.management_fee_pct / 100);
  }

  return found ? total : null;
}

/**
 * Resolve the agent-fee figures to report, preferring confirmed statements and
 * always disclosing which source was used.
 */
export function resolveAgentFees(
  payments: ReadonlyArray<AgentFeePayment>,
  tenancies: ReadonlyArray<AgentFeeTenancy>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): AgentFeeResolution {
  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);
  const inYear = payments.filter(
    (p) => p.payment_date >= startDate && p.payment_date <= endDate,
  );

  const actual = confirmedAgentFeesForFy(
    payments,
    fyEndYear,
    startMonth,
    startDay,
  );
  const estimated = estimatedAgentFeesForFy(
    tenancies,
    fyEndYear,
    startMonth,
    startDay,
  );

  const unconfirmedCount = inYear.filter(
    (p) => p.fees_confirmed_at == null && hasAnyFee(p),
  ).length;
  const paymentsWithConfirmedFees = inYear.filter(
    (p) => p.fees_confirmed_at != null && hasAnyFee(p),
  ).length;

  const source: AgentFeeSource | null =
    actual != null ? "actual" : estimated != null ? "estimated" : null;

  return {
    commission: actual?.commission ?? estimated ?? 0,
    // An estimate carries no sundry component — a percentage of rent cannot
    // produce a bank charge.
    sundries: actual?.sundries ?? 0,
    source,
    actual,
    estimated,
    unconfirmedCount,
    paymentsInYear: inYear.length,
    paymentsWithConfirmedFees,
    partial:
      paymentsWithConfirmedFees > 0 &&
      paymentsWithConfirmedFees < inYear.length,
  };
}
