/**
 * Division 43 capital works register.
 *
 * A capital works deduction runs at a fixed rate from the date the works were
 * COMPLETED, until the whole amount has been written off — 40 years at the
 * standard residential rate of 2.5%, 25 years at 4%.
 *
 * Each item therefore carries its own clock. A bathroom finished in 2019 and a
 * deck finished in 2025 are six years apart in their write-down, and no single
 * property-level figure can represent both. The register is built per item and
 * summed.
 *
 * Eligibility and the applicable rate are the owner's quantity surveyor's
 * determination, not this product's — the rate is read from the item, never
 * inferred. See migration 057.
 */
import {
  AU_FY_START_DAY,
  AU_FY_START_MONTH,
  daysInFy,
  fyBounds,
} from "@/lib/tax/fy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CapitalWorksItem {
  id: string;
  amount: number;
  /** Completion date — starts the clock. Null means it has not been determined. */
  startDate: string | null;
  /** Annual rate. 2.5% standard residential; 4% where a QS determines it. */
  ratePct: number;
  description?: string | null;
}

export interface Div43ItemClaim {
  id: string;
  description: string | null;
  amount: number;
  startDate: string | null;
  ratePct: number;
  /** Years over which the amount writes off entirely, i.e. 100 / rate. */
  lifeYears: number;
  /** Days the item was on foot within the selected year. */
  daysOnFoot: number;
  /** This year's deduction. */
  claimThisYear: number;
  /** Claimed from completion through the end of the selected year. */
  cumulativeClaimed: number;
  /** Amount less cumulative claimed. */
  writtenDownValue: number;
  /** Financial years in which some deduction arose, including this one. */
  yearsClaimed: number;
  fullyWrittenOff: boolean;
  /** True when no completion date is recorded, so nothing can be claimed. */
  missingStartDate: boolean;
}

export interface Div43Register {
  items: Div43ItemClaim[];
  totalClaim: number;
  totalWrittenDownValue: number;
  /** Items excluded because no completion date is recorded. */
  itemsMissingStartDate: number;
}

/**
 * Build the register as at the end of the given financial year.
 *
 * Each year's deduction is the annual rate prorated by the days the item was
 * on foot in that year, so a part-year first claim and a part-year final claim
 * both fall out naturally. The cumulative total is capped at the original
 * amount: capital works write off to zero, never past it.
 */
export function div43RegisterForFy(
  items: ReadonlyArray<CapitalWorksItem>,
  fyEndYear: number,
  startMonth: number = AU_FY_START_MONTH,
  startDay: number = AU_FY_START_DAY,
): Div43Register {
  const claims = items.map((item) =>
    claimForItem(item, fyEndYear, startMonth, startDay),
  );

  return {
    items: claims,
    totalClaim: claims.reduce((sum, c) => sum + c.claimThisYear, 0),
    totalWrittenDownValue: claims.reduce(
      (sum, c) => sum + c.writtenDownValue,
      0,
    ),
    itemsMissingStartDate: claims.filter((c) => c.missingStartDate).length,
  };
}

function claimForItem(
  item: CapitalWorksItem,
  fyEndYear: number,
  startMonth: number,
  startDay: number,
): Div43ItemClaim {
  const lifeYears = item.ratePct > 0 ? 100 / item.ratePct : 0;
  const base: Div43ItemClaim = {
    id: item.id,
    description: item.description ?? null,
    amount: Number(item.amount),
    startDate: item.startDate,
    ratePct: item.ratePct,
    lifeYears,
    daysOnFoot: 0,
    claimThisYear: 0,
    cumulativeClaimed: 0,
    writtenDownValue: Number(item.amount),
    yearsClaimed: 0,
    fullyWrittenOff: false,
    missingStartDate: item.startDate == null,
  };

  if (item.startDate == null || lifeYears <= 0) return base;

  const start = Date.parse(`${item.startDate}T00:00:00Z`);
  if (Number.isNaN(start)) return base;

  // The item is on foot from completion until its life expires.
  const startUtc = new Date(start);
  const expiry = Date.UTC(
    startUtc.getUTCFullYear() + lifeYears,
    startUtc.getUTCMonth(),
    startUtc.getUTCDate(),
  ) - MS_PER_DAY;

  // Walk each financial year from completion to the selected one. Capped at
  // the life in years plus one, so a very old item cannot loop unbounded.
  const firstFy = fyEndYearContaining(start, startMonth, startDay);
  let cumulative = 0;
  let yearsClaimed = 0;
  let claimThisYear = 0;
  let daysOnFootThisYear = 0;

  for (let fy = firstFy; fy <= fyEndYear; fy++) {
    const { startDate, endDate } = fyBounds(fy, startMonth, startDay);
    const fyStart = Date.parse(`${startDate}T00:00:00Z`);
    const fyEnd = Date.parse(`${endDate}T00:00:00Z`);

    const from = Math.max(start, fyStart);
    const to = Math.min(expiry, fyEnd);
    const days = to < from ? 0 : Math.round((to - from) / MS_PER_DAY) + 1;

    let yearClaim =
      days > 0
        ? base.amount * (item.ratePct / 100) * (days / daysInFy(fy, startMonth, startDay))
        : 0;

    // Capital works write off to zero and no further.
    if (cumulative + yearClaim > base.amount) {
      yearClaim = Math.max(0, base.amount - cumulative);
    }

    cumulative += yearClaim;
    if (yearClaim > 0) yearsClaimed += 1;

    if (fy === fyEndYear) {
      claimThisYear = yearClaim;
      daysOnFootThisYear = days;
    }
  }

  const writtenDownValue = base.amount - cumulative;

  return {
    ...base,
    daysOnFoot: daysOnFootThisYear,
    claimThisYear,
    cumulativeClaimed: cumulative,
    writtenDownValue,
    yearsClaimed,
    fullyWrittenOff: writtenDownValue <= 1e-6,
  };
}

/** The financial year (identified by its end year) that a date falls inside. */
function fyEndYearContaining(
  timestamp: number,
  startMonth: number,
  startDay: number,
): number {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const boundary = Date.UTC(year, startMonth - 1, startDay);
  const dayUtc = Date.UTC(year, d.getUTCMonth(), d.getUTCDate());
  const startYear = dayUtc >= boundary ? year : year - 1;
  return startMonth === 1 && startDay === 1 ? startYear : startYear + 1;
}
