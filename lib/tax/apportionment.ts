/**
 * Apportioning rental figures to the taxpayer's share.
 *
 * Two factors apply, and they apply to different things:
 *
 *   Ownership share  -> BOTH income and deductions. A half owner declares half
 *                       the rent and claims half the expenses.
 *   Days available   -> DEDUCTIONS ONLY. Rent received is rent received; it is
 *                       never scaled down because the property was off the
 *                       market for part of the year. Scaling income by
 *                       availability would understate assessable rent.
 *
 * Private-use days are subtracted from the available days rather than treated
 * as a separate factor: a day the owner occupied the property is not a day it
 * was available to rent.
 */
import type { PropertyFyFacts } from "@/lib/supabase/database.types";

/** The subset of per-year facts apportionment depends on. */
export type ApportionmentFacts = Pick<
  PropertyFyFacts,
  "ownership_pct" | "days_available_for_rent" | "private_use_days"
>;

export interface Apportionment {
  /** Ownership share as a fraction, 0–1. */
  ownershipFraction: number;
  /** Deductible days as a fraction of the year, 0–1. */
  deductibleDayFraction: number;
  /** True when ownership was not recorded and sole ownership was assumed. */
  assumedSoleOwnership: boolean;
  /** True when availability was not recorded and a full year was assumed. */
  assumedFullYear: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolve the apportionment factors for a property-year.
 *
 * Absent facts fall back to sole ownership and full-year availability, and the
 * fallback is reported through `assumed*` so the report can say it assumed
 * rather than presenting an assumption as a recorded fact.
 */
export function computeApportionment(
  facts: ApportionmentFacts | null | undefined,
  daysInYear: number,
): Apportionment {
  const ownershipRecorded = facts?.ownership_pct != null;
  const availabilityRecorded = facts?.days_available_for_rent != null;

  const ownershipFraction = ownershipRecorded
    ? clamp01(Number(facts!.ownership_pct) / 100)
    : 1;

  const availableDays = availabilityRecorded
    ? Number(facts!.days_available_for_rent)
    : daysInYear;
  const privateDays = facts?.private_use_days ?? 0;

  // A day of private use is not a day available to rent, so it is removed from
  // the available days rather than applied as a second factor.
  const deductibleDays = Math.max(0, availableDays - Number(privateDays));
  const deductibleDayFraction =
    daysInYear > 0 ? clamp01(deductibleDays / daysInYear) : 0;

  return {
    ownershipFraction,
    deductibleDayFraction,
    assumedSoleOwnership: !ownershipRecorded,
    assumedFullYear: !availabilityRecorded,
  };
}

/**
 * The taxpayer's share of an income amount.
 *
 * Ownership only — deliberately not reduced by availability or private use.
 */
export function apportionIncome(
  amount: number,
  apportionment: Apportionment,
): number {
  return amount * apportionment.ownershipFraction;
}

/**
 * The taxpayer's claimable share of a deduction.
 *
 * Ownership and deductible days together.
 */
export function apportionDeduction(
  amount: number,
  apportionment: Apportionment,
): number {
  return (
    amount *
    apportionment.ownershipFraction *
    apportionment.deductibleDayFraction
  );
}
