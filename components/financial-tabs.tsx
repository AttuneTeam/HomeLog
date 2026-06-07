"use client";

import { FinancialPositionView } from "@/components/financial-position-view";
import {
  IncomeSourcesPanel,
  type IncomeSource,
} from "@/components/income-sources-panel";
import {
  HouseholdExpensesPanel,
  type HouseholdExpense,
} from "@/components/household-expenses-panel";
import { type RoiInputs } from "@/components/roi-calculator";

interface Property {
  id: string;
  address: string;
  suburb: string | null;
  state: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  property_type: string;
  renovations: {
    id: string;
    name: string;
    classification: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    claimable: boolean | null;
    expenses: {
      id: string;
      amount: number;
      expense_date: string;
      category: string;
      manual_classification: string | null;
    }[];
  }[];
}

interface RentalPeriodRow {
  property_id: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_fee_pct: number | null;
}

interface RentalExpenseRow {
  property_id: string;
  category: string;
  amount: number;
  expense_date: string;
}

interface LoanRateRow {
  id: string;
  property_id: string;
  rate: number;
  effective_date: string;
}

interface PropertyLoanRow {
  property_id: string;
  loan_amount: number;
  loan_term_years: number;
}

interface Props {
  properties: Property[];
  financialYearStartMonth: number;
  financialYearStartDay: number;
  roiInputsByPropertyId: Record<string, RoiInputs>;
  rentalPeriodsByPropertyId: Record<string, RentalPeriodRow[]>;
  rentalExpensesByPropertyId: Record<string, RentalExpenseRow[]>;
  loanRatesByPropertyId: Record<string, LoanRateRow[]>;
  propertyLoanByPropertyId: Record<string, PropertyLoanRow>;
  offsetsByPropertyId: Record<string, number>;
  incomeSources: IncomeSource[];
  householdExpenses: HouseholdExpense[];
  financialYearEnd: number;
  prepaidTax: number;
}

export function FinancialTabs({
  properties,
  financialYearStartMonth,
  financialYearStartDay,
  roiInputsByPropertyId,
  rentalPeriodsByPropertyId,
  rentalExpensesByPropertyId,
  loanRatesByPropertyId,
  propertyLoanByPropertyId,
  offsetsByPropertyId,
  incomeSources,
  householdExpenses,
  prepaidTax,
  financialYearEnd,
}: Props) {
  const investmentProperties = properties.filter(
    (p) => p.property_type !== "primary_residence",
  );

  function toMonthly(amount: number, frequency: string): number {
    if (frequency === "quarterly") return amount / 3;
    if (frequency === "yearly") return amount / 12;
    return amount;
  }

  const monthlyHouseholdExpenses = householdExpenses.reduce(
    (sum, e) => sum + toMonthly(e.amount, e.frequency),
    0,
  );

  return (
    <div className="px-6 pt-6 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Household Finances</h1>
      </div>
      <div className="space-y-4">
        <IncomeSourcesPanel initialSources={incomeSources} />
        <HouseholdExpensesPanel initialExpenses={householdExpenses} financialYearEnd={financialYearEnd} />
      </div>
      <FinancialPositionView
        properties={properties}
        financialYearStartMonth={financialYearStartMonth}
        financialYearStartDay={financialYearStartDay}
        roiInputsByPropertyId={roiInputsByPropertyId}
        rentalPeriodsByPropertyId={rentalPeriodsByPropertyId}
        rentalExpensesByPropertyId={rentalExpensesByPropertyId}
        loanRatesByPropertyId={loanRatesByPropertyId}
        propertyLoanByPropertyId={propertyLoanByPropertyId}
        offsetsByPropertyId={offsetsByPropertyId}
        incomeSources={incomeSources}
        monthlyHouseholdExpenses={monthlyHouseholdExpenses}
        prepaidTax={prepaidTax}
        financialYearEnd={financialYearEnd}
      />
    </div>
  );
}
