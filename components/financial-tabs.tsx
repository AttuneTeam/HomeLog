"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialPositionView } from "@/components/financial-position-view";
import {
  IncomeSourcesPanel,
  type IncomeSource,
} from "@/components/income-sources-panel";
import { RoiCalculator, type RoiInputs } from "@/components/roi-calculator";
import { ScenarioComparisonTab } from "@/components/scenario-comparison-tab";

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
  userId: string;
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
  prepaidTax: number;
  financialYearEnd: number;
}

export function FinancialTabs({
  userId,
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
  prepaidTax,
  financialYearEnd,
}: Props) {
  const investmentProperties = properties.filter(
    (p) => p.property_type !== "primary_residence",
  );

  return (
    <div>
      <div className="px-6 pt-6">
        <Tabs defaultValue="position">
          <TabsList>
            <TabsTrigger value="position">Financial Position</TabsTrigger>
            <TabsTrigger value="scenarios">Scenario Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="position">
            <div className="space-y-0">
              <div className="pt-6">
                <IncomeSourcesPanel initialSources={incomeSources} />
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
                prepaidTax={prepaidTax}
                financialYearEnd={financialYearEnd}
              />
            </div>
          </TabsContent>

          <TabsContent value="calculator" className="py-6">
            <RoiCalculator
              userId={userId}
              properties={investmentProperties}
              roiInputsByPropertyId={roiInputsByPropertyId}
              financialYearStartMonth={financialYearStartMonth}
              financialYearStartDay={financialYearStartDay}
            />
          </TabsContent>

          <TabsContent value="scenarios" className="py-6">
            <ScenarioComparisonTab
              properties={investmentProperties}
              propertyLoanByPropertyId={propertyLoanByPropertyId}
              loanRatesByPropertyId={loanRatesByPropertyId}
              offsetsByPropertyId={offsetsByPropertyId}
              rentalPeriodsByPropertyId={rentalPeriodsByPropertyId}
              incomeSources={incomeSources}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
