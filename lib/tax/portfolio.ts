/**
 * Portfolio-level aggregation of per-property rental schedules.
 *
 * The pack is generated for a whole portfolio, but a return is prepared per
 * property, so both views have to exist and they have to agree. Everything
 * here is derived by summing the per-property schedules — no figure is
 * recomputed from source data, which is what would let the two drift apart.
 *
 * Properties excluded from rental reporting (a primary residence) are carried
 * through with their reason rather than dropped, so the pack can account for
 * every property the owner holds.
 */
import type { RentalSchedule, ScheduleLine } from "@/lib/tax/rental-schedule";

export interface PortfolioEntry {
  propertyId: string;
  address: string;
  schedule: RentalSchedule;
  /** CGT cost base, carried through per property rather than aggregated. */
  costBase: number;
}

export interface PortfolioSummary {
  /** Properties with a rental schedule, in the order supplied. */
  included: PortfolioEntry[];
  /** Properties excluded from rental reporting, with their reason. */
  excluded: Array<{ propertyId: string; address: string; reason: string }>;
  totalGrossRent: number;
  /** Deduction lines summed across properties, in schedule order. */
  deductionTotals: ScheduleLine[];
  totalDeductions: number;
  netResult: number;
  isLoss: boolean;
  /** Number of included properties that individually ran at a loss. */
  propertiesAtLoss: number;
  totalCostBase: number;
}

export function buildPortfolioSummary(
  entries: ReadonlyArray<PortfolioEntry>,
): PortfolioSummary {
  const included: PortfolioEntry[] = [];
  const excluded: PortfolioSummary["excluded"] = [];

  for (const entry of entries) {
    if (entry.schedule.excludedReason) {
      excluded.push({
        propertyId: entry.propertyId,
        address: entry.address,
        reason: entry.schedule.excludedReason,
      });
    } else {
      included.push(entry);
    }
  }

  // Sum deduction lines by key while preserving the order they first appear
  // in, which is the schedule order each property already used.
  const lineTotals = new Map<string, ScheduleLine>();
  for (const entry of included) {
    for (const line of entry.schedule.deductions) {
      const existing = lineTotals.get(line.key);
      if (existing) {
        existing.amount += line.amount;
      } else {
        lineTotals.set(line.key, { ...line });
      }
    }
  }

  const totalGrossRent = included.reduce(
    (sum, e) => sum + e.schedule.grossRent,
    0,
  );
  // Summed from the per-property totals, not recomputed from the lines, so a
  // portfolio figure can never disagree with the schedules behind it.
  const totalDeductions = included.reduce(
    (sum, e) => sum + e.schedule.totalDeductions,
    0,
  );
  const netResult = included.reduce((sum, e) => sum + e.schedule.netResult, 0);

  return {
    included,
    excluded,
    totalGrossRent,
    deductionTotals: [...lineTotals.values()],
    totalDeductions,
    netResult,
    isLoss: netResult < 0,
    propertiesAtLoss: included.filter((e) => e.schedule.isLoss).length,
    totalCostBase: included.reduce((sum, e) => sum + e.costBase, 0),
  };
}
