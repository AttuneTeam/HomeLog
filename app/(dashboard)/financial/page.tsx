import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinancialTabs } from "@/components/financial-tabs";
import type { RoiInputs } from "@/components/roi-calculator";

export default async function FinancialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: properties }] = await Promise.all([
    supabase
      .from("profiles")
      .select("financial_year_start_month, financial_year_start_day")
      .eq("id", user.id)
      .single(),
    supabase
      .from("properties")
      .select(
        `
        id, address, suburb, state, purchase_date, purchase_price, property_type,
        renovations(
          id, name, classification, status, start_date, end_date, claimable,
          expenses(id, amount, expense_date, category, classification_override)
        )
      `,
      )
      .order("created_at", { ascending: false }),
  ]);

  const fyMonth = profile?.financial_year_start_month ?? 7;
  const fyDay = profile?.financial_year_start_day ?? 1;

  // Fetch ROI inputs for all investment properties
  const investmentPropertyIds = (properties ?? [])
    .filter((p) => p.property_type !== "primary_residence")
    .map((p) => p.id);

  const { data: roiRows } = investmentPropertyIds.length
    ? await supabase
        .from("roi_calculator_inputs")
        .select("*")
        .in("property_id", investmentPropertyIds)
    : { data: [] };

  const roiInputsByPropertyId: Record<string, RoiInputs> = {};
  for (const row of roiRows ?? []) {
    roiInputsByPropertyId[row.property_id] = {
      purchase_price: row.purchase_price,
      stamp_duty: row.stamp_duty,
      legal_fees: row.legal_fees,
      capital_growth_rate: row.capital_growth_rate,
      weekly_rent: row.weekly_rent,
      management_fee_rate: row.management_fee_rate,
      council_rates: row.council_rates,
      insurance: row.insurance,
      maintenance: row.maintenance,
      loan_amount: row.loan_amount,
      interest_rate: row.interest_rate,
      loan_term: row.loan_term,
      div43_depreciation: row.div43_depreciation,
      div40_depreciation: row.div40_depreciation,
      marginal_tax_rate: row.marginal_tax_rate,
      annual_household_income: row.annual_household_income,
    };
  }

  return (
    <FinancialTabs
      userId={user.id}
      properties={properties ?? []}
      financialYearStartMonth={fyMonth}
      financialYearStartDay={fyDay}
      roiInputsByPropertyId={roiInputsByPropertyId}
    />
  );
}
