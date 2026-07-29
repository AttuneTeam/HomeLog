/**
 * Reconciles the two classification vocabularies in the schema.
 *
 * `renovations.classification` and `expenses.manual_classification` are
 * different Postgres enums with different labels for the same concepts:
 *
 *   renovations.classification        repair | capital_improvement | initial_repair
 *   expenses.manual_classification    Repair | Capital Works       | Immediate Repair
 *
 * The manual column is an optional per-expense override, so it is null for
 * most expenses and the renovation's value is inherited. Comparing that
 * inherited value directly against the tax vocabulary never matches, which
 * silently routed every unoverridden capital improvement into repairs —
 * deducting capital spend in the current year and understating the CGT cost
 * base. Resolution belongs here, once, rather than being re-derived at each
 * call site.
 *
 * ⚠️ "Immediate Repair" names an *initial repair at purchase* — work done to
 * bring a property to a rentable condition. Despite how the label reads it is
 * NOT deductible in the current year: it is capital and belongs in the cost
 * base. Use `isDeductibleNow` rather than reasoning from the label.
 *
 * A third vocabulary exists on the AI classification path
 * (`AiTaxClassification`: "Immediate Deduction" | "Capital Works (Div 43)" |
 * "Plant & Equipment (Div 40)"). It is not part of this resolution because the
 * report reads the manual and renovation columns only.
 */
import type {
  Classification,
  ManualTaxClassification,
} from "@/lib/supabase/database.types";

/** The vocabulary tax reporting works in. */
export type TaxClassification = ManualTaxClassification;

const RENOVATION_TO_TAX: Record<Classification, TaxClassification> = {
  repair: "Repair",
  capital_improvement: "Capital Works",
  initial_repair: "Immediate Repair",
};

/**
 * The tax treatment that applies to an expense: its own manual override when
 * one is set, otherwise the treatment inherited from its renovation.
 */
export function resolveTaxClassification(
  manual: ManualTaxClassification | null | undefined,
  renovationClassification: Classification,
): TaxClassification {
  return manual ?? RENOVATION_TO_TAX[renovationClassification];
}

/**
 * Whether the expense is deductible in the year it was incurred.
 *
 * Only a plain repair is. Capital works and initial repairs at purchase are
 * both capital: they go to the CGT cost base, and capital works may then
 * attract a Division 43 deduction spread over 40 years.
 */
export function isDeductibleNow(classification: TaxClassification): boolean {
  return classification === "Repair";
}
