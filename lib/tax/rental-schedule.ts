/**
 * The rental schedule for one property in one financial year.
 *
 * Presents figures in the order an Australian rental schedule runs — gross
 * rent, then deductions, then the net result — so an accountant can key it in
 * without reordering. Cash expenses are listed alphabetically, as the ATO
 * schedule does; the two computed deductions (capital works and decline in
 * value) come last, because they are not payments and have no invoice behind
 * them.
 *
 * Classification is resolved through lib/tax/classification.ts rather than
 * re-derived here. The two enum vocabularies do not match, and comparing them
 * directly is what previously reported capital improvements as immediately
 * deductible repairs.
 */
import {
  apportionDeduction,
  apportionIncome,
  type Apportionment,
} from "@/lib/tax/apportionment";
import { resolveTaxClassification } from "@/lib/tax/classification";
import type {
  Classification,
  ManualTaxClassification,
  RentalExpenseCategory,
} from "@/lib/supabase/database.types";

/** Operating expense categories mapped to their rental schedule line. */
const CATEGORY_LINES: Record<
  RentalExpenseCategory,
  { key: string; label: string }
> = {
  strata_fees: { key: "body_corporate", label: "Body corporate fees" },
  council_rates: { key: "council_rates", label: "Council rates" },
  insurance: { key: "insurance", label: "Insurance" },
  land_tax: { key: "land_tax", label: "Land tax" },
  repairs_maintenance: { key: "repairs", label: "Repairs and maintenance" },
  water: { key: "water", label: "Water charges" },
  other: { key: "sundry", label: "Sundry rental expenses" },
};

/** Deduction lines in schedule order. Cash expenses first, then computed. */
const DEDUCTION_ORDER = [
  "body_corporate",
  "council_rates",
  "insurance",
  "interest",
  "land_tax",
  "agent_fees",
  "repairs",
  "water",
  "sundry",
  "capital_works",
  "decline_in_value",
] as const;

const DEDUCTION_LABELS: Record<(typeof DEDUCTION_ORDER)[number], string> = {
  body_corporate: "Body corporate fees",
  council_rates: "Council rates",
  insurance: "Insurance",
  interest: "Interest on loans",
  land_tax: "Land tax",
  agent_fees: "Property agent fees and commission",
  repairs: "Repairs and maintenance",
  water: "Water charges",
  sundry: "Sundry rental expenses",
  capital_works: "Capital works deduction (Division 43)",
  decline_in_value: "Decline in value (Division 40)",
};

export interface ScheduleOperatingExpense {
  category: RentalExpenseCategory;
  amount: number;
}

export interface ScheduleRenovationExpense {
  amount: number;
  /** Per-expense override; null means inherit from the renovation. */
  manual_classification: ManualTaxClassification | null;
  renovation_classification: Classification;
  /** Renovations marked non-claimable are excluded entirely. */
  claimable?: boolean;
}

export interface RentalScheduleInput {
  propertyType: string;
  grossRent: number | null;
  agentFees: number;
  operatingExpenses: ReadonlyArray<ScheduleOperatingExpense>;
  renovationExpenses: ReadonlyArray<ScheduleRenovationExpense>;
  /** Confirmed loan statements only. */
  interest: number;
  /** This year's Division 43 claim from the register. */
  capitalWorks: number;
  /** Division 40 as stated by the quantity surveyor, if any. */
  declineInValue: number | null;
  apportionment: Apportionment;
}

export interface ScheduleLine {
  key: string;
  label: string;
  /** Already apportioned to the taxpayer's share. */
  amount: number;
}

export interface RentalSchedule {
  /** Null when the property is excluded from rental reporting. */
  excludedReason: string | null;
  grossRent: number;
  deductions: ScheduleLine[];
  totalDeductions: number;
  netResult: number;
  /** True when deductions exceed income — a negatively geared year. */
  isLoss: boolean;
}

/**
 * Build the schedule. Returns an excluded result for a primary residence,
 * which has no rental schedule at all.
 */
export function buildRentalSchedule(
  input: RentalScheduleInput,
): RentalSchedule {
  if (input.propertyType === "primary_residence") {
    return {
      excludedReason: "Primary residence — not a rental property",
      grossRent: 0,
      deductions: [],
      totalDeductions: 0,
      netResult: 0,
      isLoss: false,
    };
  }

  const totals = new Map<string, number>();
  const add = (key: string, amount: number) => {
    if (amount === 0) return;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  };

  for (const expense of input.operatingExpenses) {
    const line = CATEGORY_LINES[expense.category];
    if (!line) continue;
    add(line.key, Number(expense.amount));
  }

  // Only a plain repair is deductible now. Capital works and initial repairs
  // are capital: they belong in the cost base, and capital works then attracts
  // its own Division 43 line below.
  for (const expense of input.renovationExpenses) {
    if (expense.claimable === false) continue;
    const classification = resolveTaxClassification(
      expense.manual_classification,
      expense.renovation_classification,
    );
    if (classification === "Repair") add("repairs", Number(expense.amount));
  }

  add("agent_fees", input.agentFees);
  add("interest", input.interest);
  add("capital_works", input.capitalWorks);
  if (input.declineInValue != null) {
    add("decline_in_value", input.declineInValue);
  }

  const deductions: ScheduleLine[] = DEDUCTION_ORDER.filter((key) =>
    totals.has(key),
  ).map((key) => ({
    key,
    label: DEDUCTION_LABELS[key],
    amount: apportionDeduction(totals.get(key)!, input.apportionment),
  }));

  const grossRent =
    input.grossRent != null
      ? apportionIncome(input.grossRent, input.apportionment)
      : 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const netResult = grossRent - totalDeductions;

  return {
    excludedReason: null,
    grossRent,
    deductions,
    totalDeductions,
    netResult,
    isLoss: netResult < 0,
  };
}
