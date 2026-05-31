import type { XeroJournalLine, XeroManualJournal } from "./client";
import type { HomeBaseCategory } from "./categories";
import { INCOME_CATEGORIES } from "./categories";

// ─── Input data shapes ────────────────────────────────────────────────────────

export interface RentalPeriod {
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_fee_pct: number | null;
}

export interface RentalOperatingExpense {
  category: string;
  amount: number | string;
  gst_amount: number | string | null;
  expense_date: string;
  description: string | null;
  supplier: string | null;
}

export interface Expense {
  expense_date: string;
  amount: number | string;
  gst_amount: number | string | null;
  description: string | null;
  supplier: string | null;
  manual_classification: string | null;
}

export interface Renovation {
  name: string;
  classification: string;
  expenses: Expense[];
}

export interface PropertyLoan {
  loan_amount: number;
}

export interface LoanInterestRate {
  rate: number;
  effective_date: string;
}

export interface AccountMapping {
  home_base_category: string;
  xero_account_code: string;
  xero_tracking_category_id: string | null;
}

export interface MapperInput {
  propertyAddress: string;
  financialYear: string;
  fyStart: Date;
  fyEnd: Date;
  rentalPeriods: RentalPeriod[];
  rentalOperatingExpenses: RentalOperatingExpense[];
  renovations: Renovation[];
  propertyLoan: PropertyLoan | null;
  loanInterestRates: LoanInterestRate[];
  accountMappings: AccountMapping[];
  trackingCategoryName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: number | string | null | undefined): number {
  return Number(v ?? 0);
}

function fyClampedWeeks(
  period: { start_date: string; end_date: string | null },
  fyStart: Date,
  fyEnd: Date,
): number {
  const today = new Date();
  const start = new Date(
    Math.max(new Date(period.start_date).getTime(), fyStart.getTime()),
  );
  const end = new Date(
    Math.min(
      (period.end_date ? new Date(period.end_date) : today).getTime(),
      fyEnd.getTime(),
    ),
  );
  if (end <= start) return 0;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
}

// Computes estimated loan interest over the FY by segmenting rate periods.
// Each segment: principal × (rate/100) × (overlapping days / 365)
function computeLoanInterest(
  loanAmount: number,
  rates: LoanInterestRate[],
  fyStart: Date,
  fyEnd: Date,
): number {
  if (loanAmount <= 0 || rates.length === 0) return 0;

  const sorted = [...rates].sort(
    (a, b) => a.effective_date.localeCompare(b.effective_date),
  );

  const fyStartMs = fyStart.getTime();
  const fyEndMs = fyEnd.getTime();
  let total = 0;

  for (let i = 0; i < sorted.length; i++) {
    const segStart = Math.max(
      new Date(sorted[i].effective_date).getTime(),
      fyStartMs,
    );
    const segEnd =
      i + 1 < sorted.length
        ? Math.min(
            new Date(sorted[i + 1].effective_date).getTime() - 1,
            fyEndMs,
          )
        : fyEndMs;

    if (segEnd < segStart) continue;

    const days = (segEnd - segStart) / (1000 * 60 * 60 * 24);
    total += loanAmount * (sorted[i].rate / 100) * (days / 365);
  }

  return total;
}

// Map renovation expense effective classification to a home_base_category.
function classifyRenovationExpense(
  manualClassification: string | null,
  renovationClassification: string,
): HomeBaseCategory {
  const effective = manualClassification ?? renovationClassification;

  switch (effective) {
    case "Capital Works":
    case "capital_improvement":
      return "div43_capital_works";
    case "Immediate Repair":
    case "initial_repair":
      // Initial repairs are capital (work done before/at start of rental, not deductible)
      return "initial_repair";
    case "Plant & Equipment (Div 40)":
      return "div40_plant_equipment";
    default:
      // "repair", "Repair", "Immediate Deduction" — immediately deductible
      return "immediate_deduction";
  }
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export function buildXeroManualJournal(input: MapperInput): {
  journal: XeroManualJournal;
  recordCount: number;
  missingCategories: HomeBaseCategory[];
} {
  const {
    propertyAddress,
    financialYear,
    fyStart,
    fyEnd,
    rentalPeriods,
    rentalOperatingExpenses,
    renovations,
    propertyLoan,
    loanInterestRates,
    accountMappings,
    trackingCategoryName,
  } = input;

  const fyStartStr = fyStart.toISOString().slice(0, 10);
  const fyEndStr = fyEnd.toISOString().slice(0, 10);

  // Build a lookup: category → account code
  const codeFor: Partial<Record<HomeBaseCategory, string>> = {};
  for (const m of accountMappings) {
    codeFor[m.home_base_category as HomeBaseCategory] = m.xero_account_code;
  }
  const clearingCode = codeFor.clearing_account;
  const trackingCatId =
    accountMappings.find((m) => m.xero_tracking_category_id)
      ?.xero_tracking_category_id ?? null;

  const missingCategories = new Set<HomeBaseCategory>();
  const lines: XeroJournalLine[] = [];

  function addLine(
    amount: number,
    category: HomeBaseCategory,
    description: string,
    taxType: "GST" | "EXEMPTINPUT" | "NONE",
    propertyOption?: string,
  ) {
    if (Math.abs(amount) < 0.01) return;
    const code = codeFor[category];
    if (!code) {
      missingCategories.add(category);
      return;
    }

    const isIncome = INCOME_CATEGORIES.includes(category);
    // Convention: positive LineAmount = debit (expense), negative = credit (income)
    const lineAmount = isIncome ? -Math.abs(amount) : Math.abs(amount);

    const line: XeroJournalLine = {
      LineAmount: lineAmount,
      AccountCode: code,
      Description: description,
      TaxType: taxType,
    };

    if (trackingCategoryName && propertyOption) {
      line.Tracking = [{ Name: trackingCategoryName, Option: propertyOption }];
    }

    lines.push(line);
  }

  const propertyShortName = propertyAddress.split(",")[0].trim();

  // 1. Rental income
  let totalRentalIncome = 0;
  for (const period of rentalPeriods) {
    const weeks = fyClampedWeeks(period, fyStart, fyEnd);
    if (weeks <= 0) continue;
    const income = weeks * period.weekly_rent;
    totalRentalIncome += income;
  }
  if (totalRentalIncome > 0) {
    addLine(
      totalRentalIncome,
      "rental_income",
      `Rental income — ${propertyShortName} — FY ${financialYear}`,
      "EXEMPTINPUT", // Australian residential rent is input-taxed
      propertyShortName,
    );
  }

  // 2. Management fees
  for (const period of rentalPeriods) {
    if (!period.management_fee_pct) continue;
    const weeks = fyClampedWeeks(period, fyStart, fyEnd);
    if (weeks <= 0) continue;
    const fee = weeks * period.weekly_rent * (period.management_fee_pct / 100);
    if (fee > 0) {
      addLine(
        fee,
        "management_fees",
        `Property management fees — ${propertyShortName} — FY ${financialYear}`,
        "GST",
        propertyShortName,
      );
    }
  }

  // 3. Rental operating expenses
  const rentalCategoryMap: Record<string, HomeBaseCategory> = {
    water: "water",
    council_rates: "council_rates",
    insurance: "insurance",
    repairs_maintenance: "repairs_maintenance",
    strata_fees: "strata_fees",
    land_tax: "land_tax",
    other: "other_rental_expense",
  };

  for (const exp of rentalOperatingExpenses) {
    if (exp.expense_date < fyStartStr || exp.expense_date > fyEndStr) continue;
    const cat = rentalCategoryMap[exp.category] ?? "other_rental_expense";
    const amount = n(exp.amount);
    if (amount <= 0) continue;
    const hasGst = n(exp.gst_amount) > 0;
    const label = exp.supplier ?? exp.description ?? exp.category;
    addLine(
      amount,
      cat,
      `${label} — ${exp.expense_date}`,
      hasGst ? "GST" : "NONE",
      propertyShortName,
    );
  }

  // 4. Renovation expenses
  for (const renovation of renovations) {
    for (const expense of renovation.expenses) {
      if (expense.expense_date < fyStartStr || expense.expense_date > fyEndStr)
        continue;
      const amount = n(expense.amount);
      if (amount <= 0) continue;
      const cat = classifyRenovationExpense(
        expense.manual_classification,
        renovation.classification,
      );
      const hasGst = n(expense.gst_amount) > 0;
      const label =
        expense.supplier ?? expense.description ?? renovation.name;
      addLine(
        amount,
        cat,
        `${renovation.name} — ${label} — ${expense.expense_date}`,
        hasGst ? "GST" : "NONE",
        propertyShortName,
      );
    }
  }

  // 5. Loan interest
  if (propertyLoan && loanInterestRates.length > 0) {
    const interest = computeLoanInterest(
      propertyLoan.loan_amount,
      loanInterestRates,
      fyStart,
      fyEnd,
    );
    if (interest > 0) {
      addLine(
        interest,
        "loan_interest",
        `Loan interest — ${propertyShortName} — FY ${financialYear}`,
        "NONE",
        propertyShortName,
      );
    }
  }

  // 6. Balancing line to clearing account
  const netDebit = lines.reduce((sum, l) => sum + l.LineAmount, 0);
  if (Math.abs(netDebit) >= 0.01) {
    if (!clearingCode) {
      missingCategories.add("clearing_account");
    } else {
      lines.push({
        LineAmount: -netDebit,
        AccountCode: clearingCode,
        Description: `Home Base export clearing — ${propertyShortName} — FY ${financialYear}`,
        TaxType: "NONE",
      });
    }
  }

  const journal: XeroManualJournal = {
    Narration: `Home Base — ${propertyAddress} — FY ${financialYear}`,
    Date: fyEndStr,
    ShowOnCashBasisReports: true,
    LineAmountTypes: "INCLUSIVE",
    JournalLines: lines,
  };

  return {
    journal,
    recordCount: lines.length,
    missingCategories: [...missingCategories],
  };
}
