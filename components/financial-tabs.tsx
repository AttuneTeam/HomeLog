"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialPositionView } from "@/components/financial-position-view";
import { RoiCalculator, type RoiInputs } from "@/components/roi-calculator";

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
      classification_override: string | null;
    }[];
  }[];
}

interface Props {
  userId: string;
  properties: Property[];
  financialYearStartMonth: number;
  financialYearStartDay: number;
  roiInputsByPropertyId: Record<string, RoiInputs>;
}

export function FinancialTabs({
  userId,
  properties,
  financialYearStartMonth,
  financialYearStartDay,
  roiInputsByPropertyId,
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
            <TabsTrigger value="calculator">Investment Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="position">
            <FinancialPositionView
              properties={properties}
              financialYearStartMonth={financialYearStartMonth}
              financialYearStartDay={financialYearStartDay}
            />
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
        </Tabs>
      </div>
    </div>
  );
}
