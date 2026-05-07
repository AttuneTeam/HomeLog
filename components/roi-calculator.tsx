"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoiInputs {
  purchase_price: number | null;
  stamp_duty: number | null;
  legal_fees: number | null;
  capital_growth_rate: number | null;
  weekly_rent: number | null;
  management_fee_rate: number | null;
  council_rates: number | null;
  insurance: number | null;
  maintenance: number | null;
  loan_amount: number | null;
  interest_rate: number | null;
  loan_term: number | null;
  div43_depreciation: number | null;
  div40_depreciation: number | null;
  marginal_tax_rate: number | null;
  annual_household_income: number | null;
}

const DEFAULTS: RoiInputs = {
  purchase_price: null,
  stamp_duty: null,
  legal_fees: null,
  capital_growth_rate: 5,
  weekly_rent: null,
  management_fee_rate: 8,
  council_rates: null,
  insurance: null,
  maintenance: null,
  loan_amount: null,
  interest_rate: null,
  loan_term: 30,
  div43_depreciation: 0,
  div40_depreciation: 0,
  marginal_tax_rate: 32.5,
  annual_household_income: null,
};

const TAX_BRACKETS = [
  { label: "19% ($18,201–$45,000)", value: 19 },
  { label: "32.5% ($45,001–$135,000)", value: 32.5 },
  { label: "37% ($135,001–$190,000)", value: 37 },
  { label: "45% ($190,001+)", value: 45 },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function n(v: number | null | undefined): number {
  return v ?? 0;
}

function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return pv / nper;
  return (
    (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1)
  );
}

function formatChartCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)
    return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

// ATO 2024-25 income tax + Medicare levy (2%)
function calcAusTax(income: number): number {
  if (income <= 0) return 0;
  const medicare = income * 0.02;
  if (income <= 18_200) return medicare;
  if (income <= 45_000) return (income - 18_200) * 0.19 + medicare;
  if (income <= 135_000) return 5_092 + (income - 45_000) * 0.325 + medicare;
  if (income <= 190_000) return 34_317 + (income - 135_000) * 0.37 + medicare;
  return 54_697 + (income - 190_000) * 0.45 + medicare;
}

// Returns the marginal rate bracket (%) for a given income
function marginalRateForIncome(income: number): number {
  if (income <= 18_200) return 0;
  if (income <= 45_000) return 19;
  if (income <= 135_000) return 32.5;
  if (income <= 190_000) return 37;
  return 45;
}

// ─── Sub-components (MUST live outside RoiCalculator to keep stable identity) ─

interface NumInputProps {
  label: string;
  value: number | null;
  onChange: (raw: string) => void;
  hint?: string;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
}

const NumInput = memo(function NumInput({
  label,
  value,
  onChange,
  hint,
  prefix,
  suffix,
  step = "any",
  min,
}: NumInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          min={min}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={prefix ? "pl-7" : suffix ? "pr-10" : ""}
        />
        {suffix && (
          <span className="absolute right-3 text-muted-foreground text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
});

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative" | "neutral";
}

function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  const colour =
    highlight === "positive"
      ? "text-green-600 dark:text-green-400"
      : highlight === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${colour}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────

type SaveState = "clean" | "dirty" | "saving" | "saved";

interface SaveButtonProps {
  state: SaveState;
  onSave: () => void;
}

function SaveButton({ state, onSave }: SaveButtonProps) {
  if (state === "clean") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Up to date
      </span>
    );
  }
  if (state === "saving") {
    return (
      <Button size="sm" disabled>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </Button>
    );
  }
  if (state === "saved") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-800"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Saved
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={onSave}>
      <Save className="h-3.5 w-3.5" />
      Save changes
    </Button>
  );
}

// ─── Monthly position row helper ──────────────────────────────────────────────

function PositionRow({
  label,
  value,
  sub,
  bold,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  bold?: boolean;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const colour =
    highlight === "positive"
      ? "text-green-600 dark:text-green-400"
      : highlight === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div
      className={`flex items-start justify-between gap-4 ${bold ? "border-t pt-3 mt-1" : ""}`}
    >
      <div>
        <p
          className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <p
        className={`text-sm font-medium whitespace-nowrap ${bold ? "text-base font-semibold" : ""} ${colour}`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InvestmentProperty {
  id: string;
  address: string;
  purchase_price: number | null;
  renovations: {
    claimable: boolean | null;
    classification: string;
    expenses: {
      amount: number;
      expense_date: string;
      manual_classification: string | null;
    }[];
  }[];
}

interface Props {
  userId: string;
  properties: InvestmentProperty[];
  roiInputsByPropertyId: Record<string, RoiInputs>;
  financialYearStartMonth: number;
  financialYearStartDay: number;
}

function getFyStart(month: number, day: number): Date {
  const today = new Date();
  const m = today.getMonth() + 1;
  const fyYear =
    m > month || (m === month && today.getDate() >= day)
      ? today.getFullYear()
      : today.getFullYear() - 1;
  return new Date(fyYear, month - 1, day);
}

export function RoiCalculator({
  userId,
  properties,
  roiInputsByPropertyId,
  financialYearStartMonth,
  financialYearStartDay,
}: Props) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    properties[0]?.id ?? null
  );

  const initialInputs = selectedPropertyId
    ? (roiInputsByPropertyId[selectedPropertyId] ?? null)
    : null;

  // Auto-populate purchase_price from property if no saved inputs yet
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const seedInputs: RoiInputs = {
    ...DEFAULTS,
    ...(initialInputs ?? {}),
    ...(initialInputs === null && selectedProperty?.purchase_price
      ? { purchase_price: selectedProperty.purchase_price }
      : {}),
  };

  const [inputs, setInputs] = useState<RoiInputs>(seedInputs);
  const [saveState, setSaveState] = useState<SaveState>(
    initialInputs ? "clean" : "dirty",
  );
  const supabase = createClient();

  // Recompute actualFyRepairs for the selected property from tracked expenses
  const actualFyRepairs = useMemo(() => {
    if (!selectedProperty) return 0;
    const fyStart = getFyStart(financialYearStartMonth, financialYearStartDay);
    const today = new Date();
    return selectedProperty.renovations
      .filter((r) => r.claimable !== false)
      .flatMap((r) =>
        r.expenses.filter((e) => {
          const d = new Date(e.expense_date);
          const effClass = e.manual_classification ?? r.classification;
          return effClass === "Repair" && d >= fyStart && d <= today;
        })
      )
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [selectedProperty, financialYearStartMonth, financialYearStartDay]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback((field: keyof RoiInputs, raw: string) => {
    const parsed = raw === "" ? null : parseFloat(raw);
    setInputs((prev) => ({
      ...prev,
      [field]: isNaN(parsed as number) ? null : parsed,
    }));
    setSaveState("dirty");
  }, []);

  const handlePropertyChange = useCallback((propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const saved = roiInputsByPropertyId[propertyId] ?? null;
    const prop = properties.find((p) => p.id === propertyId) ?? null;
    setInputs({
      ...DEFAULTS,
      ...(saved ?? {}),
      ...(saved === null && prop?.purchase_price
        ? { purchase_price: prop.purchase_price }
        : {}),
    });
    setSaveState(saved ? "clean" : "dirty");
  }, [roiInputsByPropertyId, properties]);

  const handleSave = useCallback(async () => {
    if (!selectedPropertyId) return;
    setSaveState("saving");
    await supabase
      .from("roi_calculator_inputs")
      .upsert({ user_id: userId, property_id: selectedPropertyId, ...inputs }, { onConflict: "property_id" });
    setSaveState("saved");
    setTimeout(() => setSaveState("clean"), 2500);
  }, [supabase, selectedPropertyId, inputs]);

  const field = useCallback(
    (f: keyof RoiInputs) => ({
      value: inputs[f],
      onChange: (raw: string) => handleChange(f, raw),
    }),
    [inputs, handleChange],
  );

  // ── Core calculations ──────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const purchasePrice = n(inputs.purchase_price);
    const stampDuty = n(inputs.stamp_duty);
    const legalFees = n(inputs.legal_fees);
    const totalCashInvested =
      purchasePrice - n(inputs.loan_amount) + stampDuty + legalFees;
    const annualRent = n(inputs.weekly_rent) * 52;
    const managementFees = annualRent * (n(inputs.management_fee_rate) / 100);
    const annualOpex =
      managementFees +
      n(inputs.council_rates) +
      n(inputs.insurance) +
      n(inputs.maintenance);
    const annualInterest =
      n(inputs.loan_amount) * (n(inputs.interest_rate) / 100);
    const monthlyRate = n(inputs.interest_rate) / 100 / 12;
    const nper = n(inputs.loan_term) * 12;
    const annualPI = pmt(monthlyRate, nper, n(inputs.loan_amount)) * 12;
    const totalDepreciation =
      n(inputs.div43_depreciation) + n(inputs.div40_depreciation);

    // Tracked FY repairs are a real deduction for year 1
    const taxableIncome =
      annualRent -
      annualOpex -
      annualInterest -
      totalDepreciation -
      actualFyRepairs;

    const taxRate = n(inputs.marginal_tax_rate) / 100;
    const taxBenefit = -taxableIncome * taxRate;
    const preTaxCashFlow = annualRent - annualOpex - annualPI;
    const afterTaxCashFlow = preTaxCashFlow + taxBenefit;
    const grossYield =
      purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
    const netYieldNoTax =
      purchasePrice > 0 ? ((annualRent - annualOpex) / purchasePrice) * 100 : 0;
    const cashOnCash =
      totalCashInvested > 0 ? (afterTaxCashFlow / totalCashInvested) * 100 : 0;
    const isNegativelyGeared = taxableIncome < 0;
    const negGearingBenefit = isNegativelyGeared ? taxBenefit : 0;

    const netRentAfterOpex = annualRent - annualOpex;
    const taxBenefitAmt = Math.max(0, taxBenefit);
    let rentPct = annualPI > 0 ? (netRentAfterOpex / annualPI) * 100 : 0;
    let taxPct = annualPI > 0 ? (taxBenefitAmt / annualPI) * 100 : 0;
    rentPct = Math.min(rentPct, 100);
    taxPct = Math.min(taxPct, 100 - Math.max(0, rentPct));
    const ownerPct = Math.max(0, 100 - rentPct - taxPct);
    const ownerAmt = annualPI > 0 ? annualPI * (ownerPct / 100) : 0;

    return {
      totalCashInvested,
      annualRent,
      annualOpex,
      annualInterest,
      annualPI,
      taxableIncome,
      taxBenefit,
      preTaxCashFlow,
      afterTaxCashFlow,
      grossYield,
      netYieldNoTax,
      cashOnCash,
      isNegativelyGeared,
      negGearingBenefit,
      payingBreakdown: {
        rentPct,
        taxPct,
        ownerPct,
        netRentAfterOpex,
        taxBenefitAmt,
        ownerAmt,
      },
    };
  }, [inputs, actualFyRepairs]);

  // ── Household income / monthly position ───────────────────────────────────

  const household = useMemo(() => {
    const income = inputs.annual_household_income;
    if (!income || income <= 0) return null;

    const taxNoProperty = calcAusTax(income);
    const monthlyTakeHomeBase = (income - taxNoProperty) / 12;

    // Property taxable income uses the same basis as calc (incl. tracked repairs)
    const propertyTaxableIncome = calc.taxableIncome;
    const adjustedIncome = income + propertyTaxableIncome;
    const taxWithProperty = calcAusTax(Math.max(0, adjustedIncome));

    const annualTaxAdjustment = taxNoProperty - taxWithProperty; // positive = saving
    const monthlyTaxAdjustment = annualTaxAdjustment / 12;
    const monthlyPropCashFlow = calc.preTaxCashFlow / 12;
    const monthlyTakeHomeNet =
      monthlyTakeHomeBase + monthlyPropCashFlow + monthlyTaxAdjustment;
    const monthlyDelta = monthlyTakeHomeNet - monthlyTakeHomeBase;

    const suggestedBracket = marginalRateForIncome(income);

    return {
      income,
      taxNoProperty,
      monthlyTakeHomeBase,
      annualTaxAdjustment,
      monthlyTaxAdjustment,
      monthlyPropCashFlow,
      monthlyTakeHomeNet,
      monthlyDelta,
      suggestedBracket,
    };
  }, [inputs.annual_household_income, calc.taxableIncome, calc.preTaxCashFlow]);

  // ── Year-by-year projection ────────────────────────────────────────────────

  const projectionData = useMemo(() => {
    const growthRate = n(inputs.capital_growth_rate) / 100;
    const taxRate = n(inputs.marginal_tax_rate) / 100;
    const purchasePrice = n(inputs.purchase_price);
    const costBase =
      purchasePrice + n(inputs.stamp_duty) + n(inputs.legal_fees);
    const monthlyRate = n(inputs.interest_rate) / 100 / 12;
    const nper = n(inputs.loan_term) * 12;
    const annualPI = pmt(monthlyRate, nper, n(inputs.loan_amount)) * 12;
    const totalDepreciation =
      n(inputs.div43_depreciation) + n(inputs.div40_depreciation);

    let cumulative = -calc.totalCashInvested;
    return Array.from({ length: 10 }, (_, i) => {
      const yr = i + 1;
      const rent = n(inputs.weekly_rent) * 52 * Math.pow(1.03, yr - 1);
      const mgmtFee = rent * (n(inputs.management_fee_rate) / 100);
      const opex =
        (mgmtFee +
          n(inputs.council_rates) +
          n(inputs.insurance) +
          n(inputs.maintenance)) *
        Math.pow(1.03, yr - 1);
      const interest = n(inputs.loan_amount) * (n(inputs.interest_rate) / 100);
      // Only year 1 includes tracked repairs; future years unknown
      const repairsThisYear = yr === 1 ? actualFyRepairs : 0;
      const taxableIncome =
        rent - opex - interest - totalDepreciation - repairsThisYear;
      const taxBenefit = -taxableIncome * taxRate;
      const afterTaxCashFlow = rent - opex - annualPI + taxBenefit;
      cumulative += afterTaxCashFlow;

      const propertyValue = purchasePrice * Math.pow(1 + growthRate, yr);
      const capitalGain = propertyValue - costBase;
      const cgt = capitalGain * 0.5 > 0 ? capitalGain * 0.5 * taxRate : 0;

      return {
        year: yr,
        annualCashFlow: Math.round(afterTaxCashFlow),
        cumulativeCashFlow: Math.round(cumulative),
        propertyValue: Math.round(propertyValue),
        cgt: Math.round(cgt),
      };
    });
  }, [inputs, calc.totalCashInvested, actualFyRepairs]);

  const breakEvenYear =
    projectionData.find((r) => r.cumulativeCashFlow >= 0)?.year ?? null;
  const year5 = projectionData[4];
  const year10 = projectionData[9];

  // ── Render ─────────────────────────────────────────────────────────────────

  // Empty state — no investment properties
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No investment properties yet</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Mark a property as <strong>Investment</strong> on its edit page to analyse it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Analysing:</label>
        <select
          value={selectedPropertyId ?? ""}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </select>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <strong>Estimation purposes only.</strong> This calculator uses
          simplified assumptions and does not constitute financial or tax
          advice. Results will vary based on your specific circumstances. Always
          consult a qualified tax professional or financial adviser before
          making investment decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Inputs column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Inputs
            </h3>
            <SaveButton state={saveState} onSave={handleSave} />
          </div>

          <SectionCard title="Property">
            <NumInput
              label="Purchase price"
              prefix="$"
              {...field("purchase_price")}
            />
            <NumInput label="Stamp duty" prefix="$" {...field("stamp_duty")} />
            <NumInput
              label="Legal & other costs"
              prefix="$"
              {...field("legal_fees")}
            />
            <NumInput
              label="Capital growth rate"
              suffix="%"
              step="0.1"
              hint="Annual assumption"
              {...field("capital_growth_rate")}
            />
          </SectionCard>

          <SectionCard title="Rental Income">
            <NumInput
              label="Weekly rent"
              prefix="$"
              hint={
                inputs.weekly_rent
                  ? `Annual: ${formatCurrency(n(inputs.weekly_rent) * 52)}`
                  : undefined
              }
              {...field("weekly_rent")}
            />
          </SectionCard>

          <SectionCard title="Operating Expenses">
            <NumInput
              label="Management fee"
              suffix="%"
              step="0.1"
              hint="% of rental income"
              {...field("management_fee_rate")}
            />
            <NumInput
              label="Council rates (annual)"
              prefix="$"
              {...field("council_rates")}
            />
            <NumInput
              label="Landlord insurance (annual)"
              prefix="$"
              {...field("insurance")}
            />
            <NumInput
              label="Maintenance & other (annual)"
              prefix="$"
              {...field("maintenance")}
            />
          </SectionCard>

          <SectionCard title="Loan">
            <NumInput
              label="Loan amount"
              prefix="$"
              {...field("loan_amount")}
            />
            <NumInput
              label="Interest rate"
              suffix="%"
              step="0.01"
              {...field("interest_rate")}
            />
            <NumInput
              label="Loan term"
              suffix="yrs"
              step="1"
              min="1"
              {...field("loan_term")}
            />
          </SectionCard>

          {/* Tracked repairs banner */}
          {actualFyRepairs > 0 && (
            <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  Tracked FY Repairs: {formatCurrency(actualFyRepairs)}
                </p>
                <p className="text-xs mt-0.5 text-blue-700 dark:text-blue-400">
                  Auto-included as a tax deduction from your tracked expenses.
                </p>
              </div>
            </div>
          )}

          <SectionCard title="Depreciation">
            <NumInput
              label="Div 43 — Capital works"
              prefix="$"
              hint="Annual building depreciation"
              {...field("div43_depreciation")}
            />
            <NumInput
              label="Div 40 — Plant & equipment"
              prefix="$"
              hint="Annual asset depreciation"
              {...field("div40_depreciation")}
            />
          </SectionCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Tax & Household Income
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Annual household income
                </Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none">
                    $
                  </span>
                  <Input
                    type="number"
                    step="1000"
                    min="0"
                    value={inputs.annual_household_income ?? ""}
                    onChange={(e) =>
                      handleChange("annual_household_income", e.target.value)
                    }
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to calculate real monthly take-home. Your gross
                  employment income before tax.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Marginal tax rate for projections
                </Label>
                {household && household.suggestedBracket > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Based on your income: {household.suggestedBracket}% bracket
                    suggested
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {TAX_BRACKETS.map((b) => (
                    <label
                      key={b.value}
                      className="flex items-center gap-2.5 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="marginal_tax_rate"
                        value={b.value}
                        checked={n(inputs.marginal_tax_rate) === b.value}
                        onChange={() =>
                          handleChange("marginal_tax_rate", String(b.value))
                        }
                        className="accent-primary"
                      />
                      <span className="text-sm">
                        {b.label}
                        {household &&
                          household.suggestedBracket === b.value && (
                            <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">
                              ← your bracket
                            </span>
                          )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sticky save at bottom */}
          <div className="flex justify-end pt-2">
            <SaveButton state={saveState} onSave={handleSave} />
          </div>
        </div>

        {/* ── Results column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Results
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Cash-on-Cash Return"
              value={`${calc.cashOnCash.toFixed(2)}%`}
              highlight={calc.cashOnCash >= 0 ? "positive" : "negative"}
              sub="After-tax / cash invested"
            />
            <MetricCard
              label="Gross Rental Yield"
              value={`${calc.grossYield.toFixed(2)}%`}
              highlight="neutral"
              sub="Annual rent / purchase price"
            />
            <MetricCard
              label="Net Yield (no tax benefit)"
              value={`${calc.netYieldNoTax.toFixed(2)}%`}
              highlight="neutral"
              sub="(Rent − opex) / purchase price"
            />
            <MetricCard
              label="Annual Cash Flow (after tax)"
              value={formatCurrency(calc.afterTaxCashFlow)}
              highlight={calc.afterTaxCashFlow >= 0 ? "positive" : "negative"}
              sub={`Pre-tax: ${formatCurrency(calc.preTaxCashFlow)}`}
            />
          </div>

          {/* ── Who's Paying for the Property? ────────────────────────── */}
          {calc.annualPI > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Who&apos;s Paying for the Property?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Of the{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(calc.annualPI)}
                  </span>{" "}
                  annual loan repayment, here&apos;s how each source contributes:
                </p>

                {/* Stacked bar */}
                <div className="flex h-5 w-full overflow-hidden rounded-full">
                  {calc.payingBreakdown.rentPct > 0 && (
                    <div
                      className="bg-green-500 dark:bg-green-600 transition-all"
                      style={{ width: `${calc.payingBreakdown.rentPct}%` }}
                    />
                  )}
                  {calc.payingBreakdown.taxPct > 0 && (
                    <div
                      className="bg-blue-500 dark:bg-blue-600 transition-all"
                      style={{ width: `${calc.payingBreakdown.taxPct}%` }}
                    />
                  )}
                  {calc.payingBreakdown.ownerPct > 0 && (
                    <div
                      className="bg-amber-400 dark:bg-amber-500 transition-all"
                      style={{ width: `${calc.payingBreakdown.ownerPct}%` }}
                    />
                  )}
                </div>

                {/* Rows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500 dark:bg-green-600 shrink-0" />
                      <span className="text-muted-foreground">
                        Rent (net of expenses)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {formatCurrency(calc.payingBreakdown.netRentAfterOpex)}
                        /yr
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400 w-14 text-right">
                        {calc.payingBreakdown.rentPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 dark:bg-blue-600 shrink-0" />
                      <span className="text-muted-foreground">Tax offset</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {formatCurrency(calc.payingBreakdown.taxBenefitAmt)}
                        /yr
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 w-14 text-right">
                        {calc.payingBreakdown.taxPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
                      <span className="text-muted-foreground">
                        Your own money
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {formatCurrency(calc.payingBreakdown.ownerAmt)}/yr
                      </span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400 w-14 text-right">
                        {calc.payingBreakdown.ownerPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Tax offset reflects the annual tax saving from negative
                  gearing at your selected marginal rate. Your own money is the
                  remaining after-tax shortfall you fund directly.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Monthly Household Position ─────────────────────────────── */}
          {household && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Monthly Household Position
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    Based on {formatCurrency(household.income)} income
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <PositionRow
                  label="Monthly take-home (employment only)"
                  value={household.monthlyTakeHomeBase}
                  sub={`Annual tax: ${formatCurrency(household.taxNoProperty)} (incl. 2% Medicare levy)`}
                  highlight="neutral"
                />
                <PositionRow
                  label="Property cash flow per month"
                  value={household.monthlyPropCashFlow}
                  sub="Rent minus operating expenses and loan repayments"
                  highlight={
                    household.monthlyPropCashFlow >= 0 ? "positive" : "negative"
                  }
                />
                <PositionRow
                  label="Monthly tax adjustment"
                  value={household.monthlyTaxAdjustment}
                  sub={
                    household.annualTaxAdjustment > 0
                      ? `${formatCurrency(household.annualTaxAdjustment)} annual tax refund from property deductions`
                      : `${formatCurrency(Math.abs(household.annualTaxAdjustment))} additional annual tax from property income`
                  }
                  highlight={
                    household.monthlyTaxAdjustment >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <PositionRow
                  label="Effective monthly household income"
                  value={household.monthlyTakeHomeNet}
                  bold
                  highlight={
                    household.monthlyTakeHomeNet >= 0 ? "positive" : "negative"
                  }
                />

                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    household.monthlyDelta >= 0
                      ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                  }`}
                >
                  {household.monthlyDelta >= 0 ? (
                    <TrendingUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    Property investment{" "}
                    {household.monthlyDelta >= 0 ? "adds" : "costs"}{" "}
                    <strong>
                      {formatCurrency(Math.abs(household.monthlyDelta))}/month
                    </strong>{" "}
                    compared to employment income only
                  </span>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Tax calculated using ATO 2024–25 brackets. Assumes property
                  income/loss is the only adjustment to your employment income.
                  Does not account for HECS/HELP repayments, offsets, or other
                  deductions.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Negative gearing highlight */}
          {calc.isNegativelyGeared && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Negatively Geared
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      Taxable loss of{" "}
                      {formatCurrency(Math.abs(calc.taxableIncome))} per year
                      {actualFyRepairs > 0 &&
                        ` (includes ${formatCurrency(actualFyRepairs)} tracked repairs)`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                      {formatCurrency(calc.negGearingBenefit)}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      estimated tax refund / year
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {year5 && year10 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "5-Year Projection", row: year5 },
                { label: "10-Year Projection", row: year10 },
              ].map(({ label, row }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Est. property value
                      </span>
                      <span className="font-medium">
                        {formatCurrency(row.propertyValue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Cumulative cash flow
                      </span>
                      <span
                        className={`font-medium ${
                          row.cumulativeCashFlow >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(row.cumulativeCashFlow)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        CGT on sale (est.)
                      </span>
                      <span className="font-medium">
                        {formatCurrency(row.cgt)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-1">
                      <span className="text-muted-foreground">
                        Total return (after CGT)
                      </span>
                      <span
                        className={`font-semibold ${
                          row.propertyValue -
                            n(inputs.purchase_price) +
                            row.cumulativeCashFlow -
                            row.cgt >=
                          0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(
                          row.propertyValue -
                            n(inputs.purchase_price) +
                            row.cumulativeCashFlow -
                            row.cgt,
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Break-Even</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When cumulative after-tax cash flow turns positive
                  </p>
                </div>
                <div className="text-right">
                  {breakEvenYear ? (
                    <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                      Year {breakEvenYear}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Beyond 10 years
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Cash Flow Projection (10 Years)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={projectionData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => `Yr ${v}`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={formatChartCurrency}
                    tick={{ fontSize: 11 }}
                    width={72}
                  />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [
                      formatCurrency(typeof value === "number" ? value : 0),
                      name === "annualCashFlow"
                        ? "Annual after-tax cash flow"
                        : "Cumulative cash flow",
                    ]}
                    labelFormatter={(label) => `Year ${label}`}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "annualCashFlow"
                        ? "Annual after-tax cash flow"
                        : "Cumulative cash flow"
                    }
                  />
                  <ReferenceLine
                    y={0}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    opacity={0.4}
                  />
                  <Bar dataKey="annualCashFlow" radius={[3, 3, 0, 0]}>
                    {projectionData.map((entry) => (
                      <Cell
                        key={entry.year}
                        fill={
                          entry.annualCashFlow >= 0
                            ? "oklch(0.527 0.154 150)"
                            : "oklch(0.577 0.245 27.325)"
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="cumulativeCashFlow"
                    stroke="oklch(0.488 0.243 264.376)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2">
                Bars show annual after-tax cash flow. Line shows cumulative
                position including initial cash outlay (deposit + purchase
                costs). Assumes 3% p.a. rent and expense growth. Year 1 includes{" "}
                {formatCurrency(actualFyRepairs)} tracked FY repairs as a
                deduction; future repair amounts are not projected.
              </p>
            </CardContent>
          </Card>

          {year10 && n(inputs.purchase_price) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  CGT on Eventual Sale
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost base</span>
                  <span>
                    {formatCurrency(
                      n(inputs.purchase_price) +
                        n(inputs.stamp_duty) +
                        n(inputs.legal_fees),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Estimated sale price (10 yr)
                  </span>
                  <span>{formatCurrency(year10.propertyValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capital gain</span>
                  <span>
                    {formatCurrency(
                      year10.propertyValue -
                        n(inputs.purchase_price) -
                        n(inputs.stamp_duty) -
                        n(inputs.legal_fees),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>50% CGT discount applied (held &gt; 12 months)</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-medium">
                  <span>Estimated CGT payable</span>
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(year10.cgt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Based on 10-year projection at {n(inputs.capital_growth_rate)}
                  % p.a. growth. Actual CGT will depend on your total income in
                  the year of sale and any additional cost base adjustments.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              These calculations are estimates only and are based on simplified
              assumptions (interest-only tax treatment, fixed growth rates,
              uniform expense growth). They do not account for vacancy periods,
              body corporate fees, depreciation schedules, or changes in
              interest rates. ATO tax calculations use 2024–25 rates and do not
              include HECS/HELP repayments, low-income tax offsets, or other
              personal deductions. This is not financial advice. Consult a
              registered tax agent or financial adviser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
