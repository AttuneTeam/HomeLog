/**
 * Estimated loan interest for a financial year.
 *
 * This is a fallback shown only while no lender statement has been uploaded,
 * and it is deliberately never claimable — see components/loan-statements-panel.tsx.
 * Its job is to give the owner a sense of the figure they still need to obtain,
 * accurately enough to be useful and honestly enough that nobody mistakes it
 * for the lender's number.
 *
 * Three things make it materially better than balance x rate:
 *
 *   Loan start date  — a loan drawn down on 27 October leaves 247 days of a
 *                      1 July year, not 365. Ignoring this overstated the first
 *                      year by roughly a third.
 *   Rate history     — loan_interest_rates records when each rate took effect,
 *                      so the year is charged in segments rather than at
 *                      whichever rate happens to be latest.
 *   Offset balance   — an offset reduces the interest-bearing balance directly,
 *                      so it is netted off before any interest is computed.
 *
 * What it still does NOT do is amortise: the balance is held constant for the
 * year. For a principal-and-interest loan that overstates interest, since the
 * balance actually falls. `assumedConstantBalance` is returned so the caller
 * can say so rather than leaving the reader to assume otherwise.
 */
import { AU_FY_START_DAY, AU_FY_START_MONTH, daysInFy, fyBounds } from "@/lib/tax/fy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LoanInterestRate {
  rate: number;
  effective_date: string;
}

export interface LoanInterestInput {
  loanAmount: number | null | undefined;
  /** Current offset balance, netted off the loan. */
  offsetBalance?: number | null;
  /** Null means the loan is assumed to have run for the whole year. */
  startDate?: string | null;
  rates: ReadonlyArray<LoanInterestRate>;
}

export interface LoanInterestEstimate {
  interest: number;
  /** Loan less offset, floored at zero. */
  interestBearingBalance: number;
  /** Days of the year the loan was on foot. */
  daysCharged: number;
  daysInYear: number;
  /** Distinct rate periods the charge was split across. */
  rateSegments: number;
  /** True when no start date was recorded and a full year was assumed. */
  assumedFullYear: boolean;
  /** Always true: the estimate does not amortise the balance. */
  assumedConstantBalance: true;
}

/**
 * Estimate interest for the year, or null when there is not enough recorded to
 * estimate anything — no loan amount, or no rate ever recorded.
 */
export function estimateInterestForFy(
  input: LoanInterestInput,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): LoanInterestEstimate | null {
  if (input.loanAmount == null || input.rates.length === 0) return null;

  const { startDate, endDate } = fyBounds(fyEndYear, startMonth, startDay);
  const fyStart = Date.parse(`${startDate}T00:00:00Z`);
  const fyEnd = Date.parse(`${endDate}T00:00:00Z`);
  const yearDays = daysInFy(fyEndYear, startMonth, startDay);

  const balance = Math.max(
    0,
    Number(input.loanAmount) - Number(input.offsetBalance ?? 0),
  );

  // The loan is only on foot from its start date, if one is recorded.
  const loanStart = input.startDate
    ? Date.parse(`${input.startDate}T00:00:00Z`)
    : fyStart;
  const chargeFrom = Math.max(Number.isNaN(loanStart) ? fyStart : loanStart, fyStart);

  if (chargeFrom > fyEnd) {
    return {
      interest: 0,
      interestBearingBalance: balance,
      daysCharged: 0,
      daysInYear: yearDays,
      rateSegments: 0,
      assumedFullYear: input.startDate == null,
      assumedConstantBalance: true,
    };
  }

  // Order rates by when they took effect, then walk the charging window,
  // switching rate whenever a later one takes effect inside it.
  const ordered = [...input.rates].sort((a, b) =>
    a.effective_date.localeCompare(b.effective_date),
  );

  // The rate in force when charging begins is the latest one effective on or
  // before that date; if none, the earliest recorded rate.
  const boundaries: Array<{ at: number; rate: number }> = [];
  let openingRate = ordered[0].rate;
  for (const r of ordered) {
    const at = Date.parse(`${r.effective_date}T00:00:00Z`);
    if (Number.isNaN(at)) continue;
    if (at <= chargeFrom) {
      openingRate = r.rate;
    } else if (at <= fyEnd) {
      boundaries.push({ at, rate: r.rate });
    }
  }

  const segments: Array<{ from: number; to: number; rate: number }> = [];
  let cursor = chargeFrom;
  let currentRate = openingRate;
  for (const boundary of boundaries) {
    if (boundary.at > cursor) {
      segments.push({ from: cursor, to: boundary.at - MS_PER_DAY, rate: currentRate });
      cursor = boundary.at;
    }
    currentRate = boundary.rate;
  }
  segments.push({ from: cursor, to: fyEnd, rate: currentRate });

  let interest = 0;
  let daysCharged = 0;
  for (const segment of segments) {
    // Inclusive of both ends: interest accrues on the closing day too.
    const days = Math.round((segment.to - segment.from) / MS_PER_DAY) + 1;
    if (days <= 0) continue;
    daysCharged += days;
    interest += balance * (segment.rate / 100) * (days / yearDays);
  }

  return {
    interest,
    interestBearingBalance: balance,
    daysCharged,
    daysInYear: yearDays,
    rateSegments: segments.length,
    assumedFullYear: input.startDate == null,
    assumedConstantBalance: true,
  };
}
