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

  // If user is a co-owner, use the account owner's ID for income/prepayment queries
  const { data: guestOf } = await supabase
    .from("account_members")
    .select("owner_id")
    .eq("grantee_user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const incomeOwnerId = guestOf?.owner_id ?? user.id;

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
          expenses(id, amount, expense_date, category, manual_classification)
        )
      `,
      )
      .order("created_at", { ascending: false }),
  ]);

  const fyMonth = profile?.financial_year_start_month ?? 7;
  const fyDay = profile?.financial_year_start_day ?? 1;

  // Compute current FY end year (e.g. July 2025 start → 2026 end)
  const today = new Date();
  const fyStartMonth = fyMonth - 1;
  const fyStartYear =
    today.getMonth() > fyStartMonth ||
    (today.getMonth() === fyStartMonth && today.getDate() >= fyDay)
      ? today.getFullYear()
      : today.getFullYear() - 1;
  const fyEndYear = fyStartYear + 1;

  // Fetch ROI inputs for all investment properties
  const investmentPropertyIds = (properties ?? [])
    .filter((p) => p.property_type !== "primary_residence")
    .map((p) => p.id);

  const [
    { data: roiRows },
    { data: rentalPeriodRows },
    { data: rentalExpenseRows },
    { data: loanRateRows },
    { data: propertyLoanRows },
    { data: incomeSourceRows },
    { data: taxPrepaymentRow },
    { data: offsetRows },
    { data: householdExpenseRows },
  ] = await Promise.all([
    investmentPropertyIds.length
      ? supabase
          .from("roi_calculator_inputs")
          .select("*")
          .in("property_id", investmentPropertyIds)
      : Promise.resolve({ data: [] }),
    investmentPropertyIds.length
      ? supabase
          .from("rental_periods")
          .select("property_id, start_date, end_date, weekly_rent, management_fee_pct")
          .in("property_id", investmentPropertyIds)
      : Promise.resolve({ data: [] }),
    investmentPropertyIds.length
      ? supabase
          .from("rental_operating_expenses")
          .select("property_id, category, amount, expense_date")
          .in("property_id", investmentPropertyIds)
      : Promise.resolve({ data: [] }),
    investmentPropertyIds.length
      ? supabase
          .from("loan_interest_rates")
          .select("id, property_id, rate, effective_date")
          .in("property_id", investmentPropertyIds)
          .order("effective_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    investmentPropertyIds.length
      ? supabase
          .from("property_loans")
          .select("property_id, loan_amount, loan_term_years")
          .in("property_id", investmentPropertyIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("household_income_sources")
      .select("id, label, amount, sort_order")
      .eq("user_id", incomeOwnerId)
      .order("sort_order"),
    supabase
      .from("tax_prepayments")
      .select("amount")
      .eq("user_id", incomeOwnerId)
      .eq("financial_year_end", fyEndYear)
      .maybeSingle(),
    investmentPropertyIds.length
      ? supabase
          .from("property_offset_accounts")
          .select("property_id, balance")
          .in("property_id", investmentPropertyIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("household_expenses")
      .select("id, label, amount, frequency, sort_order")
      .eq("user_id", incomeOwnerId)
      .eq("financial_year_end", fyEndYear)
      .order("sort_order"),
  ]);

  // Auto-seed household expenses from the prior FY if this FY has no rows yet.
  // Only seed for the account owner (co-owners read the owner's data but can't write it).
  let activeHouseholdExpenseRows = householdExpenseRows ?? [];
  if (activeHouseholdExpenseRows.length === 0 && user.id === incomeOwnerId) {
    const { data: priorRows } = await supabase
      .from("household_expenses")
      .select("label, amount, frequency, sort_order")
      .eq("user_id", user.id)
      .eq("financial_year_end", fyEndYear - 1)
      .order("sort_order");

    if (priorRows && priorRows.length > 0) {
      const { data: seeded } = await supabase
        .from("household_expenses")
        .insert(
          priorRows.map((r) => ({
            user_id: user.id,
            label: r.label,
            amount: r.amount,
            frequency: r.frequency,
            financial_year_end: fyEndYear,
            sort_order: r.sort_order,
          })),
        )
        .select("id, label, amount, frequency, sort_order");
      activeHouseholdExpenseRows = seeded ?? [];
    }
  }

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

  type RentalPeriodRow = { property_id: string; start_date: string; end_date: string | null; weekly_rent: number; management_fee_pct: number | null };
  type RentalExpenseRow = { property_id: string; category: string; amount: number; expense_date: string };

  const rentalPeriodsByPropertyId: Record<string, RentalPeriodRow[]> = {};
  for (const row of (rentalPeriodRows ?? []) as RentalPeriodRow[]) {
    (rentalPeriodsByPropertyId[row.property_id] ??= []).push(row);
  }

  const rentalExpensesByPropertyId: Record<string, RentalExpenseRow[]> = {};
  for (const row of (rentalExpenseRows ?? []) as RentalExpenseRow[]) {
    (rentalExpensesByPropertyId[row.property_id] ??= []).push(row);
  }

  type LoanRateRow = { id: string; property_id: string; rate: number; effective_date: string };
  const loanRatesByPropertyId: Record<string, LoanRateRow[]> = {};
  for (const row of (loanRateRows ?? []) as LoanRateRow[]) {
    (loanRatesByPropertyId[row.property_id] ??= []).push(row);
  }

  type PropertyLoanRow = { property_id: string; loan_amount: number; loan_term_years: number };
  const propertyLoanByPropertyId: Record<string, PropertyLoanRow> = {};
  for (const row of (propertyLoanRows ?? []) as PropertyLoanRow[]) {
    propertyLoanByPropertyId[row.property_id] = row;
  }

  type OffsetRow = { property_id: string; balance: number };
  const offsetsByPropertyId: Record<string, number> = {};
  for (const row of (offsetRows ?? []) as OffsetRow[]) {
    offsetsByPropertyId[row.property_id] =
      (offsetsByPropertyId[row.property_id] ?? 0) + Number(row.balance);
  }

  return (
    <FinancialTabs
      properties={properties ?? []}
      financialYearStartMonth={fyMonth}
      financialYearStartDay={fyDay}
      roiInputsByPropertyId={roiInputsByPropertyId}
      rentalPeriodsByPropertyId={rentalPeriodsByPropertyId}
      rentalExpensesByPropertyId={rentalExpensesByPropertyId}
      loanRatesByPropertyId={loanRatesByPropertyId}
      propertyLoanByPropertyId={propertyLoanByPropertyId}
      offsetsByPropertyId={offsetsByPropertyId}
      incomeSources={(incomeSourceRows ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        amount: Number(r.amount),
        sort_order: r.sort_order,
      }))}
      householdExpenses={activeHouseholdExpenseRows.map((r) => ({
        id: r.id,
        label: r.label,
        amount: Number(r.amount),
        frequency: r.frequency as "monthly" | "quarterly" | "yearly",
        sort_order: r.sort_order,
      }))}
      financialYearEnd={fyEndYear}
      prepaidTax={Number(taxPrepaymentRow?.amount ?? 0)}
    />
  );
}
