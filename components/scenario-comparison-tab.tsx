"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { calcAusTax } from "@/lib/tax-utils";
import { pmt } from "@/lib/finance-utils";
import type { IncomeSource } from "@/components/income-sources-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RentalPeriodRow {
  property_id: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_fee_pct: number | null;
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

interface InvestmentProperty {
  id: string;
  address: string;
  suburb: string | null;
}

interface Props {
  properties: InvestmentProperty[];
  propertyLoanByPropertyId: Record<string, PropertyLoanRow>;
  loanRatesByPropertyId: Record<string, LoanRateRow[]>;
  offsetsByPropertyId: Record<string, number>;
  rentalPeriodsByPropertyId: Record<string, RentalPeriodRow[]>;
  incomeSources: IncomeSource[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: number | null | undefined): number {
  return v ?? 0;
}

function currentRentalPeriod(periods: RentalPeriodRow[]) {
  return periods.find((p) => !p.end_date) ?? periods[periods.length - 1] ?? null;
}

function latestRate(rates: LoanRateRow[]): number {
  if (!rates.length) return 0;
  return rates[rates.length - 1].rate;
}

// ─── Comparison row ────────────────────────────────────────────────────────────

function CompareRow({
  label,
  current,
  scenario,
  format = "currency",
  lowerIsBetter = false,
  separator = false,
}: {
  label: string;
  current: number | null;
  scenario: number | null;
  format?: "currency" | "pct";
  lowerIsBetter?: boolean;
  separator?: boolean;
}) {
  const fmt = (v: number | null) => {
    if (v == null) return "—";
    return format === "pct" ? `${v.toFixed(2)}%` : formatCurrency(v);
  };

  const delta =
    current != null && scenario != null ? scenario - current : null;
  const improved =
    delta != null ? (lowerIsBetter ? delta < 0 : delta > 0) : null;

  return (
    <div
      className={`grid grid-cols-[1fr_1fr_1fr] gap-3 items-baseline py-2 text-sm ${separator ? "border-t mt-1 pt-3" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{fmt(current)}</span>
      <div className="text-right">
        <span className="tabular-nums">{fmt(scenario)}</span>
        {delta != null && Math.abs(delta) > 0.5 && (
          <span
            className={`ml-2 text-xs ${improved ? "text-emerald-600" : "text-red-600"}`}
          >
            {improved ? "▲" : "▼"} {fmt(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ScenarioComparisonTab({
  properties,
  propertyLoanByPropertyId,
  loanRatesByPropertyId,
  offsetsByPropertyId,
  rentalPeriodsByPropertyId,
  incomeSources,
}: Props) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    properties[0]?.id ?? "",
  );
  const [scenarioName, setScenarioName] = useState("Scenario A");

  // Scenario inputs — seeded from real data on property change
  const [scenarioOffsetBalance, setScenarioOffsetBalance] = useState(0);
  const [scenarioLoanAmount, setScenarioLoanAmount] = useState(0);
  const [scenarioInterestRate, setScenarioInterestRate] = useState(0);
  const [scenarioWeeklyRent, setScenarioWeeklyRent] = useState(0);
  const [scenarioManagementFeePct, setScenarioManagementFeePct] = useState(0);
  const [scenarioLoanTermYears, setScenarioLoanTermYears] = useState(30);
  const [scenarioAnnualIncome, setScenarioAnnualIncome] = useState(0);
  const [scenarioIsPrimary, setScenarioIsPrimary] = useState(false);

  // Re-seed scenario inputs when property changes
  useEffect(() => {
    if (!selectedPropertyId) return;
    const loan = propertyLoanByPropertyId[selectedPropertyId];
    const rates = loanRatesByPropertyId[selectedPropertyId] ?? [];
    const offset = offsetsByPropertyId[selectedPropertyId] ?? 0;
    const periods = rentalPeriodsByPropertyId[selectedPropertyId] ?? [];
    const period = currentRentalPeriod(periods);
    const totalIncome = incomeSources.reduce((s, src) => s + src.amount, 0);

    setScenarioOffsetBalance(offset);
    setScenarioLoanAmount(n(loan?.loan_amount));
    setScenarioInterestRate(latestRate(rates));
    setScenarioWeeklyRent(n(period?.weekly_rent));
    setScenarioManagementFeePct(n(period?.management_fee_pct));
    setScenarioLoanTermYears(n(loan?.loan_term_years) || 30);
    setScenarioAnnualIncome(totalIncome);
    setScenarioIsPrimary(false);
  }, [
    selectedPropertyId,
    propertyLoanByPropertyId,
    loanRatesByPropertyId,
    offsetsByPropertyId,
    rentalPeriodsByPropertyId,
    incomeSources,
  ]);

  // ── Baseline (from real data, read-only) ────────────────────────────────────

  const baseline = useMemo(() => {
    const loan = propertyLoanByPropertyId[selectedPropertyId];
    const rates = loanRatesByPropertyId[selectedPropertyId] ?? [];
    const actualOffset = offsetsByPropertyId[selectedPropertyId] ?? 0;
    const periods = rentalPeriodsByPropertyId[selectedPropertyId] ?? [];
    const period = currentRentalPeriod(periods);
    const totalIncome = incomeSources.reduce((s, src) => s + src.amount, 0);

    const loanAmount = n(loan?.loan_amount);
    const loanTermYears = n(loan?.loan_term_years) || 30;
    const rate = latestRate(rates);
    const effectiveLoan = Math.max(0, loanAmount - actualOffset);

    const monthlyRate = rate / 100 / 12;
    const nper = loanTermYears * 12;
    const monthlyRepayment = loanAmount > 0 ? pmt(monthlyRate, nper, loanAmount) : 0;
    const monthlyInterest = effectiveLoan * (rate / 100) / 12;

    const weeklyRent = n(period?.weekly_rent);
    const feePct = n(period?.management_fee_pct);
    const monthlyNetRent =
      (weeklyRent * 52) / 12 * (1 - feePct / 100);

    const annualInterest = effectiveLoan * (rate / 100);
    const annualNetRent = monthlyNetRent * 12;
    const taxablePropertyIncome = annualNetRent - annualInterest;
    const taxNoProp = totalIncome > 0 ? calcAusTax(totalIncome) : 0;
    const taxWithProp =
      totalIncome > 0
        ? calcAusTax(Math.max(0, totalIncome + taxablePropertyIncome))
        : 0;
    const annualTaxBenefit = Math.max(0, taxNoProp - taxWithProp);

    const monthlyOutOfPocket =
      monthlyRepayment - monthlyNetRent - annualTaxBenefit / 12;

    return {
      loanAmount,
      rate,
      monthlyRepayment,
      monthlyInterest,
      monthlyNetRent,
      annualTaxBenefit,
      monthlyOutOfPocket,
      hasRateData: rates.length > 0,
    };
  }, [
    selectedPropertyId,
    propertyLoanByPropertyId,
    loanRatesByPropertyId,
    offsetsByPropertyId,
    rentalPeriodsByPropertyId,
    incomeSources,
  ]);

  // ── Scenario (from user inputs) ────────────────────────────────────────────

  const scenario = useMemo(() => {
    const effectiveLoan = Math.max(0, scenarioLoanAmount - scenarioOffsetBalance);
    const monthlyRate = scenarioInterestRate / 100 / 12;
    const nper = scenarioLoanTermYears * 12;
    const monthlyRepayment =
      scenarioLoanAmount > 0 ? pmt(monthlyRate, nper, scenarioLoanAmount) : 0;
    const monthlyInterest = effectiveLoan * (scenarioInterestRate / 100) / 12;

    const monthlyNetRent = scenarioIsPrimary
      ? 0
      : (scenarioWeeklyRent * 52) / 12 * (1 - scenarioManagementFeePct / 100);

    const annualInterest = effectiveLoan * (scenarioInterestRate / 100);
    const annualNetRent = monthlyNetRent * 12;
    const taxablePropertyIncome = scenarioIsPrimary
      ? 0
      : annualNetRent - annualInterest;
    const taxNoProp = scenarioAnnualIncome > 0 ? calcAusTax(scenarioAnnualIncome) : 0;
    const taxWithProp =
      scenarioAnnualIncome > 0 && !scenarioIsPrimary
        ? calcAusTax(Math.max(0, scenarioAnnualIncome + taxablePropertyIncome))
        : taxNoProp;
    const annualTaxBenefit =
      scenarioIsPrimary ? 0 : Math.max(0, taxNoProp - taxWithProp);

    const monthlyOutOfPocket =
      monthlyRepayment - monthlyNetRent - annualTaxBenefit / 12;

    const monthlyInterestSaving = baseline.monthlyInterest - monthlyInterest;

    return {
      monthlyRepayment,
      monthlyInterest,
      monthlyNetRent,
      annualTaxBenefit,
      monthlyOutOfPocket,
      monthlyInterestSaving,
      annualInterestSaving: monthlyInterestSaving * 12,
    };
  }, [
    scenarioLoanAmount,
    scenarioOffsetBalance,
    scenarioInterestRate,
    scenarioWeeklyRent,
    scenarioManagementFeePct,
    scenarioLoanTermYears,
    scenarioAnnualIncome,
    scenarioIsPrimary,
    baseline,
  ]);

  if (properties.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No investment properties to compare. Add an investment property first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">
            Property:
          </label>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
                {p.suburb ? `, ${p.suburb}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">
            Scenario name:
          </label>
          <Input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="h-9 w-44 text-sm"
          />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <strong>What-if sandbox.</strong> Changes are not saved — adjust the
          inputs below to model different scenarios and compare them against your
          current position. Calculations use simplified assumptions.
        </p>
      </div>

      {!baseline.hasRateData && (
        <div className="flex gap-2 items-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          No interest rate tracked for this property — enter a rate in the
          Scenario inputs below. Add rate history on the property page for more
          accurate baseline figures.
        </div>
      )}

      <div className="grid lg:grid-cols-[2fr_3fr] gap-6 items-start">
        {/* ── Inputs ──────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenario inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary residence toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scenarioIsPrimary}
                onChange={(e) => {
                  setScenarioIsPrimary(e.target.checked);
                  if (e.target.checked) setScenarioWeeklyRent(0);
                }}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">
                Treat as primary residence
              </span>
            </label>
            {scenarioIsPrimary && (
              <p className="text-xs text-muted-foreground -mt-2 pl-7">
                No rental income or tax deductions applied.
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">Offset balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  value={scenarioOffsetBalance || ""}
                  onChange={(e) =>
                    setScenarioOffsetBalance(parseFloat(e.target.value) || 0)
                  }
                  className="pl-7 text-sm"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Loan amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  value={scenarioLoanAmount || ""}
                  onChange={(e) =>
                    setScenarioLoanAmount(parseFloat(e.target.value) || 0)
                  }
                  className="pl-7 text-sm"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Interest rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={scenarioInterestRate || ""}
                  onChange={(e) =>
                    setScenarioInterestRate(parseFloat(e.target.value) || 0)
                  }
                  className="pr-8 text-sm"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Loan term</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max="40"
                  value={scenarioLoanTermYears || ""}
                  onChange={(e) =>
                    setScenarioLoanTermYears(parseInt(e.target.value) || 30)
                  }
                  className="pr-10 text-sm"
                  placeholder="30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  yrs
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Weekly rent</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  value={scenarioWeeklyRent || ""}
                  onChange={(e) =>
                    setScenarioWeeklyRent(parseFloat(e.target.value) || 0)
                  }
                  className="pl-7 text-sm"
                  placeholder="0"
                  disabled={scenarioIsPrimary}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Management fee</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={scenarioManagementFeePct || ""}
                  onChange={(e) =>
                    setScenarioManagementFeePct(parseFloat(e.target.value) || 0)
                  }
                  className="pr-8 text-sm"
                  placeholder="0"
                  disabled={scenarioIsPrimary}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Annual household income</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={scenarioAnnualIncome || ""}
                  onChange={(e) =>
                    setScenarioAnnualIncome(parseFloat(e.target.value) || 0)
                  }
                  className="pl-7 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Results comparison ───────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span></span>
              <span className="text-right">Current</span>
              <span className="text-right">{scenarioName}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CompareRow
              label="Monthly repayment (P&I)"
              current={baseline.monthlyRepayment}
              scenario={scenario.monthlyRepayment}
              lowerIsBetter
            />
            <CompareRow
              label="Monthly interest cost"
              current={baseline.monthlyInterest}
              scenario={scenario.monthlyInterest}
              lowerIsBetter
            />
            {scenario.annualInterestSaving !== 0 && (
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 items-baseline py-2 text-sm">
                <span className="text-muted-foreground">
                  Annual interest saving
                </span>
                <span className="text-right text-muted-foreground">—</span>
                <span
                  className={`text-right font-semibold tabular-nums ${scenario.annualInterestSaving > 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {scenario.annualInterestSaving > 0 ? "+" : ""}
                  {formatCurrency(scenario.annualInterestSaving)}/yr
                </span>
              </div>
            )}
            <CompareRow
              label="Net rental income/month"
              current={baseline.monthlyNetRent}
              scenario={scenario.monthlyNetRent}
            />
            <CompareRow
              label="Tax benefit/year"
              current={baseline.annualTaxBenefit}
              scenario={scenario.annualTaxBenefit}
            />
            <CompareRow
              label="Monthly out-of-pocket"
              current={baseline.monthlyOutOfPocket}
              scenario={scenario.monthlyOutOfPocket}
              lowerIsBetter
              separator
            />

            {/* Bottom-line callout */}
            {(() => {
              const delta =
                baseline.monthlyOutOfPocket - scenario.monthlyOutOfPocket;
              if (Math.abs(delta) < 1) return null;
              return (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
                    delta > 0
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                  }`}
                >
                  <span>
                    {scenarioName}{" "}
                    {delta > 0 ? "saves" : "costs"}{" "}
                    <strong>{formatCurrency(Math.abs(delta))}/month</strong>{" "}
                    compared to current
                  </span>
                </div>
              );
            })()}

            <p className="mt-4 text-xs text-muted-foreground">
              Calculations use simplified assumptions: P&I repayments, current
              interest rate applied to effective balance, ATO 2024–25 tax
              brackets. Management fees applied to gross rent. Does not account
              for vacancy, depreciation, or operating expenses.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
