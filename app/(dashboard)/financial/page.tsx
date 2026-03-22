import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FinancialTabs } from "@/components/financial-tabs"
import type { RoiInputs } from "@/components/roi-calculator"

export default async function FinancialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: properties }, { data: roiRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("financial_year_start_month, financial_year_start_day")
      .eq("id", user.id)
      .single(),
    supabase
      .from("properties")
      .select(`
        id, address, suburb, state, purchase_date, purchase_price,
        renovations(
          id, name, classification, status, start_date, end_date, claimable,
          expenses(id, amount, expense_date, category, classification_override)
        )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("roi_calculator_inputs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  // Compute current FY repair total from tracked expenses
  const fyMonth = profile?.financial_year_start_month ?? 7
  const fyDay = profile?.financial_year_start_day ?? 1
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const fyStartYear =
    month > fyMonth || (month === fyMonth && today.getDate() >= fyDay) ? year : year - 1
  const fyStart = new Date(fyStartYear, fyMonth - 1, fyDay)

  const currentFyRepairs = (properties ?? [])
    .flatMap((p) =>
      p.renovations
        .filter((r) => r.claimable !== false)
        .flatMap((r) =>
        r.expenses.filter((e) => {
          const d = new Date(e.expense_date)
          const effClass = e.classification_override ?? r.classification
          return effClass === "repair" && d >= fyStart && d <= today
        })
      )
    )
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const savedRoiInputs: RoiInputs | null = roiRow
    ? {
        purchase_price: roiRow.purchase_price,
        stamp_duty: roiRow.stamp_duty,
        legal_fees: roiRow.legal_fees,
        capital_growth_rate: roiRow.capital_growth_rate,
        weekly_rent: roiRow.weekly_rent,
        management_fee_rate: roiRow.management_fee_rate,
        council_rates: roiRow.council_rates,
        insurance: roiRow.insurance,
        maintenance: roiRow.maintenance,
        loan_amount: roiRow.loan_amount,
        interest_rate: roiRow.interest_rate,
        loan_term: roiRow.loan_term,
        div43_depreciation: roiRow.div43_depreciation,
        div40_depreciation: roiRow.div40_depreciation,
        marginal_tax_rate: roiRow.marginal_tax_rate,
        annual_household_income: roiRow.annual_household_income,
      }
    : null

  return (
    <FinancialTabs
      userId={user.id}
      properties={properties ?? []}
      financialYearStartMonth={fyMonth}
      financialYearStartDay={fyDay}
      savedRoiInputs={savedRoiInputs}
      currentFyRepairs={currentFyRepairs}
    />
  )
}
