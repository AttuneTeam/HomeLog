"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FinancialPositionView } from "@/components/financial-position-view"
import { RoiCalculator, type RoiInputs } from "@/components/roi-calculator"

interface Property {
  id: string
  address: string
  suburb: string | null
  state: string | null
  purchase_date: string | null
  purchase_price: number | null
  renovations: {
    id: string
    name: string
    classification: "repair" | "capital_improvement"
    status: string
    start_date: string | null
    end_date: string | null
    claimable: boolean
    expenses: {
      id: string
      amount: number
      expense_date: string
      category: string
      classification_override: "repair" | "capital_improvement" | null
    }[]
  }[]
}

interface Props {
  userId: string
  properties: Property[]
  financialYearStartMonth: number
  financialYearStartDay: number
  savedRoiInputs: RoiInputs | null
  currentFyRepairs: number
}

export function FinancialTabs({
  userId,
  properties,
  financialYearStartMonth,
  financialYearStartDay,
  savedRoiInputs,
  currentFyRepairs,
}: Props) {
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
              initialInputs={savedRoiInputs}
              actualFyRepairs={currentFyRepairs}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
