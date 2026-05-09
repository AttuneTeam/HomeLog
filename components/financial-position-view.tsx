"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { calcAusTax } from "@/lib/tax-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Info,
  Pencil,
  Check,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { saveTaxPrepayment } from "@/app/actions/tax-prepayments";
import type { RoiInputs } from "@/components/roi-calculator";
import type { IncomeSource } from "@/components/income-sources-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  amount: number;
  expense_date: string;
  category: string;
  manual_classification: string | null;
}

interface Renovation {
  id: string;
  name: string;
  classification: string;
  status: string;
  claimable: boolean | null;
  expenses: Expense[];
}

interface Property {
  id: string;
  address: string;
  suburb: string | null;
  state: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  property_type: string;
  renovations: Renovation[];
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

interface FinancialPositionViewProps {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fyBounds(
  month: number,
  day: number,
): { fyStart: Date; fyEnd: Date; fyLabel: string } {
  const today = new Date();
  const m = month - 1; // 0-indexed
  const fyStartYear =
    today.getMonth() > m || (today.getMonth() === m && today.getDate() >= day)
      ? today.getFullYear()
      : today.getFullYear() - 1;
  const fyStart = new Date(fyStartYear, m, day);
  const fyEnd = new Date(fyStartYear + 1, m, day - 1);
  const fyLabel = `FY${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;
  return { fyStart, fyEnd, fyLabel };
}

function fyClampedWeeks(
  period: RentalPeriodRow,
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

function calcInterestFromRates(
  loanAmount: number,
  rates: LoanRateRow[],
  fyStart: Date,
  fyEnd: Date,
  purchaseDate?: Date,
): number {
  if (!rates.length || !loanAmount) return 0;
  const floor = purchaseDate && purchaseDate > fyStart ? purchaseDate : fyStart;
  let total = 0;
  for (let i = 0; i < rates.length; i++) {
    const rateStart = new Date(rates[i].effective_date);
    const rateEnd =
      i < rates.length - 1 ? new Date(rates[i + 1].effective_date) : fyEnd;
    const start = new Date(Math.max(rateStart.getTime(), floor.getTime()));
    const end = new Date(Math.min(rateEnd.getTime(), fyEnd.getTime()));
    if (end <= start) continue;
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    total += loanAmount * (rates[i].rate / 100) * (days / 365);
  }
  return total;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PnlRow({
  label,
  value,
  tag,
  indent,
  total,
  muted,
}: {
  label: string;
  value: number | null;
  tag?: "actual" | "est";
  indent?: boolean;
  total?: boolean;
  muted?: boolean;
}) {
  const formatted =
    value == null
      ? "—"
      : value < 0
        ? `(${formatCurrency(-value)})`
        : formatCurrency(value);

  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1 ${total ? "border-t mt-1 pt-2" : ""}`}
    >
      <span
        className={`text-sm flex items-center gap-2 ${muted ? "text-muted-foreground" : ""} ${indent ? "pl-4" : ""}`}
      >
        {label}
        {tag && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              tag === "actual"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {tag === "actual" ? "actual" : "est."}
          </span>
        )}
      </span>
      <span
        className={`text-sm tabular-nums whitespace-nowrap ${total ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}
      >
        {formatted}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinancialPositionView({
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
}: FinancialPositionViewProps) {
  const [editingPrepaid, setEditingPrepaid] = useState(false);
  const [prepaidInput, setPrepaidInput] = useState(String(prepaidTax || ""));
  const [isPrepaidPending, startPrepaidTransition] = useTransition();

  function handleSavePrepaid() {
    const amount = parseFloat(prepaidInput) || 0;
    startPrepaidTransition(async () => {
      await saveTaxPrepayment(financialYearEnd, amount);
      setEditingPrepaid(false);
    });
  }
  const { fyStart, fyEnd, fyLabel } = useMemo(
    () => fyBounds(financialYearStartMonth, financialYearStartDay),
    [financialYearStartMonth, financialYearStartDay],
  );

  const investmentProperties = properties.filter(
    (p) => p.property_type !== "primary_residence",
  );

  // Per-property P&L
  const propertyPnl = useMemo(() => {
    return investmentProperties.map((property) => {
      const periods = rentalPeriodsByPropertyId[property.id] ?? [];
      const opex = rentalExpensesByPropertyId[property.id] ?? [];
      const roi = roiInputsByPropertyId[property.id] ?? null;

      // Income (actual)
      const grossRentalIncome = periods.reduce((sum, p) => {
        const weeks = fyClampedWeeks(p, fyStart, fyEnd);
        return sum + weeks * p.weekly_rent;
      }, 0);

      const agentFees = periods.reduce((sum, p) => {
        if (!p.management_fee_pct) return sum;
        const weeks = fyClampedWeeks(p, fyStart, fyEnd);
        return sum + weeks * p.weekly_rent * (p.management_fee_pct / 100);
      }, 0);

      const operatingExpenses = opex
        .filter(
          (e) =>
            e.expense_date >= fyStart.toISOString().slice(0, 10) &&
            e.expense_date <= fyEnd.toISOString().slice(0, 10),
        )
        .reduce((s, e) => s + Number(e.amount), 0);

      const netRentalIncome = grossRentalIncome - agentFees;

      // Deductions (actual)
      const fyStartStr = fyStart.toISOString().slice(0, 10);
      const fyEndStr = fyEnd.toISOString().slice(0, 10);
      const repairs = property.renovations
        .filter((r) => r.claimable !== false && r.status !== "planned")
        .flatMap((r) =>
          r.expenses.filter((e) => {
            if (e.expense_date < fyStartStr || e.expense_date > fyEndStr)
              return false;
            const cls = e.manual_classification ?? r.classification;
            return cls === "Repair" || cls === "repair";
          }),
        )
        .reduce((s, e) => s + Number(e.amount), 0);

      // Loan amount/term: use property_loans first, fall back to ROI inputs
      const loanDetails = propertyLoanByPropertyId[property.id] ?? null;
      const loanAmount = loanDetails?.loan_amount ?? roi?.loan_amount ?? null;
      const loanTerm = loanDetails?.loan_term_years ?? roi?.loan_term ?? null;

      // Offset accounts reduce effective loan balance for interest calculation
      const totalOffset = offsetsByPropertyId[property.id] ?? 0;
      const effectiveLoanAmount = loanAmount != null
        ? Math.max(0, loanAmount - totalOffset)
        : null;

      // Loan interest: use tracked rate history if available, else fall back to flat ROI estimate
      const purchaseDate = property.purchase_date
        ? new Date(property.purchase_date)
        : undefined;
      const rates = loanRatesByPropertyId[property.id] ?? [];
      const loanInterestActual =
        rates.length > 0 && effectiveLoanAmount != null
          ? calcInterestFromRates(
              effectiveLoanAmount,
              rates,
              fyStart,
              fyEnd,
              purchaseDate,
            )
          : null;
      const loanInterestEst =
        loanInterestActual == null && effectiveLoanAmount != null && effectiveLoanAmount > 0 && roi?.interest_rate
          ? effectiveLoanAmount * (roi.interest_rate / 100)
          : loanInterestActual == null && effectiveLoanAmount === 0
            ? 0
            : null;

      // Interest saved by offset = difference between full and reduced interest
      const interestSavedByOffset =
        totalOffset > 0 && loanAmount != null && rates.length > 0
          ? calcInterestFromRates(loanAmount, rates, fyStart, fyEnd, purchaseDate) -
            calcInterestFromRates(effectiveLoanAmount!, rates, fyStart, fyEnd, purchaseDate)
          : totalOffset > 0 && loanAmount != null && roi?.interest_rate
            ? loanAmount * (roi.interest_rate / 100) - (effectiveLoanAmount! * (roi.interest_rate / 100))
            : 0;
      const loanInterest = loanInterestActual ?? loanInterestEst;
      const loanInterestIsActual = loanInterestActual != null;

      const depreciation =
        roi?.div43_depreciation != null || roi?.div40_depreciation != null
          ? (roi?.div43_depreciation ?? 0) + (roi?.div40_depreciation ?? 0)
          : null;

      const totalDeductions =
        operatingExpenses + repairs + (loanInterest ?? 0) + (depreciation ?? 0);

      const netTaxableIncome = netRentalIncome - totalDeductions;

      const hasRoiInputs = roi !== null;

      return {
        property,
        grossRentalIncome,
        agentFees,
        operatingExpenses,
        netRentalIncome,
        repairs,
        loanInterest,
        loanInterestIsActual,
        loanAmount,
        loanTerm,
        totalOffset,
        interestSavedByOffset,
        depreciation,
        totalDeductions,
        netTaxableIncome,
        hasRoiInputs,
      };
    });
  }, [
    investmentProperties,
    rentalPeriodsByPropertyId,
    rentalExpensesByPropertyId,
    roiInputsByPropertyId,
    loanRatesByPropertyId,
    offsetsByPropertyId,
    fyStart,
    fyEnd,
  ]);

  // Portfolio totals
  const portfolio = useMemo(() => {
    const totalNetRentalIncome = propertyPnl.reduce(
      (s, p) => s + p.netRentalIncome,
      0,
    );
    const totalDeductions = propertyPnl.reduce(
      (s, p) => s + p.totalDeductions,
      0,
    );
    const totalNetTaxableIncome = propertyPnl.reduce(
      (s, p) => s + p.netTaxableIncome,
      0,
    );
    return { totalNetRentalIncome, totalDeductions, totalNetTaxableIncome };
  }, [propertyPnl]);

  // Tax estimate — use income sources entered by the user
  const totalHouseholdIncome = incomeSources.reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  const taxEstimate = useMemo(() => {
    if (totalHouseholdIncome <= 0) return null;
    const taxNoProp = calcAusTax(totalHouseholdIncome);
    const adjustedIncome =
      totalHouseholdIncome + portfolio.totalNetTaxableIncome;
    const taxWithProp = calcAusTax(Math.max(0, adjustedIncome));
    const annualSaving = taxNoProp - taxWithProp;
    return {
      totalHouseholdIncome,
      adjustedIncome,
      taxNoProp,
      taxWithProp,
      annualSaving,
      monthlySaving: annualSaving / 12,
    };
  }, [totalHouseholdIncome, portfolio.totalNetTaxableIncome]);

  // Monthly cash flow breakdown — all FY months, past = actual, future = projected
  const monthlyBreakdown = useMemo(() => {
    const months: { start: Date; end: Date }[] = [];
    const cursor = new Date(fyStart.getFullYear(), fyStart.getMonth(), 1);
    while (cursor.getTime() <= fyEnd.getTime()) {
      const start = new Date(cursor);
      const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push({
        start,
        end: new Date(Math.min(lastDay.getTime(), fyEnd.getTime())),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const today = new Date();
    const monthlyTaxBenefit = taxEstimate ? taxEstimate.annualSaving / 12 : 0;

    return months.map(({ start: ms, end: me }) => {
      const isPast = me < today;
      const isCurrent = ms <= today && me >= today;
      const msStr = ms.toISOString().slice(0, 10);
      const meStr = me.toISOString().slice(0, 10);

      let totalGrossRental = 0;
      let totalNetRental = 0;
      let totalRepayment = 0;
      let totalInterest = 0;
      let hasRepaymentData = false;
      let anyPropertyOwnedThisMonth = false;

      for (const { property, loanAmount, loanTerm, totalOffset } of propertyPnl) {
        const purchasedOn = property.purchase_date
          ? new Date(property.purchase_date)
          : null;
        // Property must be purchased on or before the end of this month
        if (purchasedOn && purchasedOn > me) continue;
        anyPropertyOwnedThisMonth = true;

        const periods = rentalPeriodsByPropertyId[property.id] ?? [];
        const opex = rentalExpensesByPropertyId[property.id] ?? [];
        const roi = roiInputsByPropertyId[property.id];
        const rates = loanRatesByPropertyId[property.id] ?? [];

        // Rental income: use actual overlap for each period (open periods extend indefinitely)
        let grossRent = 0;
        let fees = 0;
        for (const p of periods) {
          const pStart = new Date(p.start_date);
          const pEnd = p.end_date
            ? new Date(p.end_date)
            : new Date("9999-12-31");
          const start = new Date(Math.max(pStart.getTime(), ms.getTime()));
          const end = new Date(Math.min(pEnd.getTime(), me.getTime()));
          if (end < start) continue;
          const weeks =
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
          grossRent += weeks * p.weekly_rent;
          if (p.management_fee_pct)
            fees += weeks * p.weekly_rent * (p.management_fee_pct / 100);
        }

        totalGrossRental += grossRent;
        totalNetRental += grossRent - fees;

        // Loan repayment: P&I at effective rate for this month (only from purchase month onwards)
        if (loanAmount && loanTerm) {
          let effectiveRate: number | null = null;
          if (rates.length > 0) {
            for (let i = rates.length - 1; i >= 0; i--) {
              if (rates[i].effective_date <= msStr) {
                effectiveRate = rates[i].rate;
                break;
              }
            }
            if (effectiveRate == null) effectiveRate = rates[0].rate;
          } else if (roi?.interest_rate) {
            effectiveRate = roi.interest_rate;
          }

          if (effectiveRate != null) {
            const r = effectiveRate / 100 / 12;
            const n = loanTerm * 12;
            const repayment =
              r > 0
                ? (loanAmount * (r * Math.pow(1 + r, n))) /
                  (Math.pow(1 + r, n) - 1)
                : loanAmount / n;
            totalRepayment += repayment;
            const effectiveLoan = Math.max(0, loanAmount - (totalOffset ?? 0));
            totalInterest += effectiveLoan * (effectiveRate / 100 / 12);
            hasRepaymentData = true;
          }
        }
      }

      const effectiveTaxBenefit = anyPropertyOwnedThisMonth
        ? monthlyTaxBenefit
        : 0;
      const net = totalNetRental - totalRepayment + effectiveTaxBenefit;
      return {
        ms,
        isPast,
        isCurrent,
        totalGrossRental,
        totalNetRental,
        totalRepayment,
        totalInterest,
        monthlyTaxBenefit: effectiveTaxBenefit,
        net,
        hasRepaymentData,
      };
    });
  }, [
    propertyPnl,
    rentalPeriodsByPropertyId,
    rentalExpensesByPropertyId,
    roiInputsByPropertyId,
    loanRatesByPropertyId,
    propertyLoanByPropertyId,
    fyStart,
    fyEnd,
    taxEstimate,
  ]);

  // Who's paying breakdown — uses monthlyBreakdown's summed repayments so purchase date is respected
  const payingBreakdown = useMemo(() => {
    const fyRepayment = monthlyBreakdown.reduce(
      (s, m) => s + m.totalRepayment,
      0,
    );
    if (fyRepayment === 0) return null;

    const fyNetRentAfterOpex = propertyPnl.reduce(
      (s, p) => s + p.netRentalIncome - p.operatingExpenses - p.repairs,
      0,
    );
    const fyTaxBenefit = Math.max(0, taxEstimate?.annualSaving ?? 0);

    let rentPct = (Math.max(0, fyNetRentAfterOpex) / fyRepayment) * 100;
    let taxPct = (fyTaxBenefit / fyRepayment) * 100;
    rentPct = Math.min(rentPct, 100);
    taxPct = Math.min(taxPct, 100 - rentPct);
    const ownerPct = Math.max(0, 100 - rentPct - taxPct);

    return {
      fyRepayment,
      fyNetRentAfterOpex,
      fyTaxBenefit,
      rentPct,
      taxPct,
      ownerPct,
      ownerAmt: fyRepayment * (ownerPct / 100),
    };
  }, [monthlyBreakdown, propertyPnl, taxEstimate]);

  if (investmentProperties.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        No investment properties found. Add a property and mark it as Investment
        to see your financial position.
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* FY header */}
      <div className="">
        <h2 className="text-xl font-semibold">Financial Position</h2>
        <span className="text-sm text-muted-foreground">
          {fyLabel} · year to date
        </span>
      </div>

      {/* Portfolio summary strip */}
      {investmentProperties.length > 1 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">
                Net rental income
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(portfolio.totalNetRentalIncome)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                all properties · actual
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">
                Total deductions
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(portfolio.totalDeductions)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                repairs + interest + depreciation
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">
                Net property income
              </p>
              <p
                className={`text-lg font-semibold tabular-nums ${portfolio.totalNetTaxableIncome < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                {portfolio.totalNetTaxableIncome < 0
                  ? `(${formatCurrency(-portfolio.totalNetTaxableIncome)})`
                  : formatCurrency(portfolio.totalNetTaxableIncome)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {portfolio.totalNetTaxableIncome < 0
                  ? "negatively geared"
                  : "positively geared"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-property P&L cards */}
      <div className="space-y-4">
        {propertyPnl.map(
          ({
            property,
            grossRentalIncome,
            agentFees,
            operatingExpenses,
            netRentalIncome,
            repairs,
            loanInterest,
            loanInterestIsActual,
            totalOffset,
            interestSavedByOffset,
            depreciation,
            totalDeductions,
            netTaxableIncome,
            hasRoiInputs,
          }) => (
            <Card key={property.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  <Link
                    href={`/properties/${property.id}`}
                    className="hover:underline"
                  >
                    {property.address}
                    {property.suburb ? `, ${property.suburb}` : ""}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Income column */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Income
                    </p>
                    <PnlRow
                      label="Gross rental income"
                      value={grossRentalIncome}
                    />
                    <PnlRow
                      label="Less: Agent fees"
                      value={agentFees > 0 ? -agentFees : 0}
                      muted
                    />
                    <PnlRow
                      label="Net rental income"
                      value={netRentalIncome}
                      total
                    />
                  </div>

                  {/* Deductions column */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Deductions
                    </p>
                    <PnlRow
                      label="Operating expenses"
                      value={operatingExpenses}
                    />
                    <PnlRow label="Repairs (tracked)" value={repairs} />
                    <PnlRow label="Loan interest" value={loanInterest} />
                    {interestSavedByOffset > 0 && (
                      <PnlRow
                        label="Interest saved (offset)"
                        value={-interestSavedByOffset}
                        muted
                        tag="actual"
                      />
                    )}
                    <PnlRow
                      label="Depreciation"
                      value={depreciation}
                      tag={depreciation != null ? "est" : undefined}
                    />
                    <PnlRow
                      label="Total deductions"
                      value={totalDeductions}
                      total
                    />
                  </div>
                </div>

                {/* Net taxable income */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {netTaxableIncome < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-sm font-medium">
                      Net taxable income from property
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {netTaxableIncome < 0
                        ? "negatively geared"
                        : "positively geared"}
                    </span>
                  </div>
                  <span
                    className={`text-base font-semibold tabular-nums ${netTaxableIncome < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {netTaxableIncome < 0
                      ? `(${formatCurrency(-netTaxableIncome)})`
                      : formatCurrency(netTaxableIncome)}
                  </span>
                </div>

                {/* Offset savings callout */}
                {interestSavedByOffset > 0 && (
                  <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                    Offset account saves{" "}
                    <span className="font-semibold">
                      {formatCurrency(interestSavedByOffset)}
                    </span>{" "}
                    in interest this FY
                    {totalOffset > 0 && (
                      <span className="text-muted-foreground">
                        {" "}({formatCurrency(totalOffset)} offset)
                      </span>
                    )}
                  </p>
                )}

                {/* Prompt if no ROI inputs */}
                {!hasRoiInputs && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <Info className="inline h-3 w-3 mr-1" />
                    Depreciation not shown —{" "}
                    <Link href="/financial" className="underline">
                      set them in the Investment Calculator
                    </Link>{" "}
                    to complete this view.
                  </p>
                )}
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Who's Paying? */}
      {payingBreakdown && (
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
                {formatCurrency(payingBreakdown.fyRepayment)}
              </span>{" "}
              in loan repayments for {fyLabel} (pro-rated to ownership period),
              here&apos;s how each source contributes:
            </p>

            <div className="flex h-5 w-full overflow-hidden rounded-full">
              {payingBreakdown.rentPct > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${payingBreakdown.rentPct}%` }}
                />
              )}
              {payingBreakdown.taxPct > 0 && (
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${payingBreakdown.taxPct}%` }}
                />
              )}
              {payingBreakdown.ownerPct > 0 && (
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${payingBreakdown.ownerPct}%` }}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground">
                    Rent (net of expenses)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {formatCurrency(
                      Math.max(0, payingBreakdown.fyNetRentAfterOpex),
                    )}
                  </span>
                  <span className="font-semibold text-green-600 w-14 text-right">
                    {payingBreakdown.rentPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-muted-foreground">Tax offset</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {formatCurrency(payingBreakdown.fyTaxBenefit)}
                  </span>
                  <span className="font-semibold text-blue-600 w-14 text-right">
                    {payingBreakdown.taxPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-muted-foreground">Your own money</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {formatCurrency(payingBreakdown.ownerAmt)}
                  </span>
                  <span className="font-semibold text-amber-600 w-14 text-right">
                    {payingBreakdown.ownerPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Repayments are counted from each property&apos;s purchase date (or{" "}
              {fyLabel} start, whichever is later). Tax offset is the estimated{" "}
              {fyLabel} tax saving from negative gearing — received at tax time,
              not monthly.
              {!taxEstimate &&
                " Add your income sources to include a tax offset estimate."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly cash flow */}
      {monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">
                Monthly Cash Flow
              </CardTitle>
              <span className="text-xs text-muted-foreground">{fyLabel}</span>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* Column headers */}
            <div className="grid grid-cols-[5rem_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 px-6 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Month</span>
              <span className="text-right">Repayment</span>
              <span className="text-right">
                Household{" "}
                <span className="normal-case font-normal">(after tax)</span>
              </span>
              <span className="text-right">Net rental</span>
              <span className="text-right">
                Tax benefit{" "}
                <span className="normal-case font-normal">(est.)</span>
              </span>
              <span className="text-right">
                Net{" "}
                <span className="normal-case font-normal">(before tax back)</span>
              </span>
              <span className="text-right">Net</span>
            </div>

            <div className="divide-y">
              {monthlyBreakdown.map(
                ({
                  ms,
                  isPast,
                  isCurrent,
                  totalNetRental,
                  totalRepayment,
                  totalInterest,
                  monthlyTaxBenefit,
                  net,
                  hasRepaymentData,
                }) => {
                  const label = ms.toLocaleString("en-AU", {
                    month: "short",
                    year: "2-digit",
                  });
                  const isProjected = !isPast && !isCurrent;
                  const monthlyHousehold =
                    (totalHouseholdIncome - calcAusTax(totalHouseholdIncome)) /
                    12;
                  const fullNet = net + monthlyHousehold;
                  return (
                    <div
                      key={ms.toISOString()}
                      className={`grid grid-cols-[5rem_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 items-center px-6 py-2 text-sm ${isCurrent ? "bg-muted/40 font-medium" : ""}`}
                    >
                      <span
                        className={`tabular-nums ${isProjected ? "text-muted-foreground" : ""}`}
                      >
                        {label}
                        {isCurrent && (
                          <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            now
                          </span>
                        )}
                      </span>
                      <div className="text-right">
                        <div
                          className={`tabular-nums ${isProjected ? "text-muted-foreground" : "text-red-600"}`}
                        >
                          {hasRepaymentData
                            ? `(${formatCurrency(totalRepayment)})`
                            : "—"}
                        </div>
                        {hasRepaymentData && totalInterest > 0 && (
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {formatCurrency(totalInterest)} interest
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-right tabular-nums ${isProjected ? "text-muted-foreground" : "text-emerald-700"}`}
                      >
                        {monthlyHousehold > 0
                          ? formatCurrency(monthlyHousehold)
                          : "—"}
                      </span>
                      <span
                        className={`text-right tabular-nums ${isProjected ? "text-muted-foreground" : ""}`}
                      >
                        {formatCurrency(totalNetRental)}
                      </span>
                      <span
                        className={`text-right tabular-nums ${monthlyTaxBenefit > 0 ? "text-emerald-700" : "text-muted-foreground"} ${isProjected ? "opacity-60" : ""}`}
                      >
                        {monthlyTaxBenefit !== 0
                          ? `+${formatCurrency(Math.abs(monthlyTaxBenefit))}`
                          : "—"}
                      </span>
                      {(() => {
                        const netBeforeTaxBack = fullNet - monthlyTaxBenefit;
                        return (
                          <span
                            className={`text-right tabular-nums font-semibold ${
                              netBeforeTaxBack >= 0 ? "text-emerald-700" : "text-red-600"
                            } ${isProjected ? "opacity-70" : ""}`}
                          >
                            {netBeforeTaxBack >= 0
                              ? `+${formatCurrency(netBeforeTaxBack)}`
                              : `(${formatCurrency(-netBeforeTaxBack)})`}
                          </span>
                        );
                      })()}
                      <span
                        className={`text-right tabular-nums font-semibold ${
                          fullNet >= 0 ? "text-emerald-700" : "text-red-600"
                        } ${isProjected ? "opacity-70" : ""}`}
                      >
                        {fullNet >= 0
                          ? `+${formatCurrency(fullNet)}`
                          : `(${formatCurrency(-fullNet)})`}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            {/* Totals row */}
            {(() => {
              const totHousehold =
                totalHouseholdIncome - calcAusTax(totalHouseholdIncome);
              const totNetRental = monthlyBreakdown.reduce(
                (s, m) => s + m.totalNetRental,
                0,
              );
              const totRepayment = monthlyBreakdown.reduce(
                (s, m) => s + m.totalRepayment,
                0,
              );
              const totInterest = monthlyBreakdown.reduce(
                (s, m) => s + m.totalInterest,
                0,
              );
              const totTaxBenefit = monthlyBreakdown.reduce(
                (s, m) => s + m.monthlyTaxBenefit,
                0,
              );
              const totNet =
                monthlyBreakdown.reduce((s, m) => s + m.net, 0) + totHousehold;
              const hasAnyRepayment = monthlyBreakdown.some(
                (m) => m.hasRepaymentData,
              );
              return (
                <div className="grid grid-cols-[5rem_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 items-center px-6 py-3 border-t bg-muted/30 text-sm font-semibold">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    FY total
                  </span>
                  <div className="text-right">
                    <div className="tabular-nums text-red-600">
                      {hasAnyRepayment
                        ? `(${formatCurrency(totRepayment)})`
                        : "—"}
                    </div>
                    {hasAnyRepayment && totInterest > 0 && (
                      <div className="text-[11px] font-normal text-muted-foreground tabular-nums">
                        {formatCurrency(totInterest)} interest
                      </div>
                    )}
                  </div>
                  <span className="text-right tabular-nums text-emerald-700">
                    {totHousehold > 0 ? formatCurrency(totHousehold) : "—"}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(totNetRental)}
                  </span>
                  <span className="text-right tabular-nums text-emerald-700">
                    {totTaxBenefit !== 0
                      ? `+${formatCurrency(Math.abs(totTaxBenefit))}`
                      : "—"}
                  </span>
                  {(() => {
                    const totNetBeforeTaxBack = totNet - totTaxBenefit;
                    return (
                      <span
                        className={`text-right tabular-nums ${totNetBeforeTaxBack >= 0 ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {totNetBeforeTaxBack >= 0
                          ? `+${formatCurrency(totNetBeforeTaxBack)}`
                          : `(${formatCurrency(-totNetBeforeTaxBack)})`}
                      </span>
                    );
                  })()}
                  <span
                    className={`text-right tabular-nums ${totNet >= 0 ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {totNet >= 0
                      ? `+${formatCurrency(totNet)}`
                      : `(${formatCurrency(-totNet)})`}
                  </span>
                </div>
              );
            })()}

            <p className="px-6 py-3 text-xs text-muted-foreground border-t">
              Future months are projected from current rates. Tax benefit is the
              estimated annual refund spread monthly — it is received at tax
              time, not monthly.
              {!monthlyBreakdown.some((m) => m.hasRepaymentData) &&
                " Add loan details in the Investment Calculator to see repayments."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tax estimate panel */}
      {taxEstimate ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Estimated Tax Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Income breakdown
                </p>
                {incomeSources.map((s) => (
                  <PnlRow key={s.id} label={s.label} value={s.amount} />
                ))}
                <PnlRow
                  label="Net property income/(loss)"
                  value={portfolio.totalNetTaxableIncome}
                />
                <PnlRow
                  label="Adjusted taxable income"
                  value={Math.max(0, taxEstimate.adjustedIncome)}
                  total
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Tax impact
                </p>
                <PnlRow
                  label="Tax without property"
                  value={taxEstimate.taxNoProp}
                  muted
                />
                <PnlRow
                  label="Tax with property"
                  value={taxEstimate.taxWithProp}
                  muted
                />

                {/* Prepaid tax (PAYG instalments) */}
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    Extra Tax paid this year
                    {!editingPrepaid && (
                      <button
                        onClick={() => {
                          setPrepaidInput(String(prepaidTax || ""));
                          setEditingPrepaid(true);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                  {editingPrepaid ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={prepaidInput}
                        onChange={(e) => setPrepaidInput(e.target.value)}
                        className="w-28 h-6 text-sm tabular-nums text-right border rounded px-2 bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSavePrepaid();
                          if (e.key === "Escape") setEditingPrepaid(false);
                        }}
                      />
                      <button
                        onClick={handleSavePrepaid}
                        disabled={isPrepaidPending}
                        className="text-emerald-700 hover:text-emerald-800"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {prepaidTax > 0 ? `(${formatCurrency(prepaidTax)})` : "—"}
                    </span>
                  )}
                </div>

                {/* Net refund / bill */}
                {(() => {
                  const netOwed = taxEstimate.taxWithProp - prepaidTax;
                  const refund = netOwed < 0;
                  return (
                    <div className="border-t mt-1 pt-2 space-y-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-semibold">
                          {refund
                            ? "Estimated refund"
                            : "Estimated tax still owed"}
                        </span>
                        <span
                          className={`text-base font-bold tabular-nums ${refund ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {refund
                            ? formatCurrency(-netOwed)
                            : `(${formatCurrency(netOwed)})`}
                        </span>
                      </div>
                      {taxEstimate.annualSaving !== 0 && (
                        <p className="text-xs text-muted-foreground">
                          Property saves you{" "}
                          {formatCurrency(Math.abs(taxEstimate.annualSaving))}{" "}
                          in tax this FY (≈{" "}
                          {taxEstimate.annualSaving >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(taxEstimate.monthlySaving))}
                          /mo)
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Estimate only. Uses 2024–25 ATO brackets + 2% Medicare levy.
                Does not include HECS/HELP, tax offsets, or income not entered
                above. Consult your tax agent before lodging.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
            <p className="font-medium text-foreground">
              Tax estimate not available
            </p>
            <p className="mt-1">
              Add your income sources above to see your estimated refund.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
