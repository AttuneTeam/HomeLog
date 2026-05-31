export const XERO_CATEGORIES = {
  rental_income: "Rental Income",
  management_fees: "Property Management Fees",
  water: "Water Rates",
  council_rates: "Council Rates",
  insurance: "Insurance",
  repairs_maintenance: "Repairs & Maintenance",
  strata_fees: "Strata / Body Corporate Fees",
  land_tax: "Land Tax",
  other_rental_expense: "Other Rental Expenses",
  immediate_deduction: "Immediate Deductions (Repairs)",
  initial_repair: "Initial Repairs (Capital)",
  div43_capital_works: "Capital Works — Div 43",
  div40_plant_equipment: "Plant & Equipment — Div 40",
  loan_interest: "Loan Interest",
  clearing_account: "Clearing / Suspense Account",
} as const;

export type HomeBaseCategory = keyof typeof XERO_CATEGORIES;

export const REQUIRED_CATEGORIES: HomeBaseCategory[] = [
  "clearing_account",
];

// Categories that represent income (credited in the journal)
export const INCOME_CATEGORIES: HomeBaseCategory[] = ["rental_income"];

// Smart default matching: if a Xero account name contains any of these
// keywords (case-insensitive), suggest it for the given category.
export const CATEGORY_KEYWORDS: Partial<Record<HomeBaseCategory, string[]>> = {
  rental_income: ["rental income", "rent"],
  management_fees: ["management", "agent"],
  water: ["water"],
  council_rates: ["council", "rates"],
  insurance: ["insurance"],
  repairs_maintenance: ["repair", "maintenance"],
  strata_fees: ["strata", "body corporate", "owners corporation"],
  land_tax: ["land tax"],
  loan_interest: ["interest", "mortgage"],
  div43_capital_works: ["capital works", "building", "div 43"],
  div40_plant_equipment: ["plant", "equipment", "depreciation", "div 40"],
  clearing_account: ["clearing", "suspense"],
};
