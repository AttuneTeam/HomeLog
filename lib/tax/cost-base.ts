/**
 * CGT cost base accumulation.
 *
 * The cost base is a lifetime figure: every capital improvement and every
 * initial repair since acquisition forms part of it, regardless of which
 * financial year is being reported. This is the one total in the pack that
 * must NOT be filtered to the selected year — doing so understates the base
 * and therefore overstates a future capital gain.
 *
 * It is also stated at 100% of the property rather than the owner's share,
 * because a disposal is calculated per owner at the time of the disposal.
 */
import { resolveTaxClassification } from "@/lib/tax/classification";
import type {
  Classification,
  ManualTaxClassification,
} from "@/lib/supabase/database.types";

export interface CostBaseExpense {
  amount: number;
  manual_classification: ManualTaxClassification | null;
}

export interface CostBaseRenovation {
  classification: Classification;
  /** Non-claimable renovations are excluded from the cost base. */
  claimable?: boolean | null;
  expenses: ReadonlyArray<CostBaseExpense>;
}

export interface CapitalTotals {
  /** Initial repairs at purchase — capital, not deductible. */
  initialRepairs: number;
  capitalImprovements: number;
}

/**
 * Total capital expenditure across every year, from all claimable
 * renovations. No date filtering: see the note above.
 */
export function capitalTotalsForCostBase(
  renovations: ReadonlyArray<CostBaseRenovation>,
): CapitalTotals {
  let initialRepairs = 0;
  let capitalImprovements = 0;

  for (const renovation of renovations) {
    if (renovation.claimable === false) continue;
    for (const expense of renovation.expenses) {
      const classification = resolveTaxClassification(
        expense.manual_classification,
        renovation.classification,
      );
      if (classification === "Immediate Repair") {
        initialRepairs += Number(expense.amount);
      } else if (classification === "Capital Works") {
        capitalImprovements += Number(expense.amount);
      }
    }
  }

  return { initialRepairs, capitalImprovements };
}
