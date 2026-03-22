"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TrendingUp, Wrench, DollarSign, Building2, Calendar, ChevronDown, ChevronRight } from "lucide-react"

interface Expense {
  id: string
  amount: number
  expense_date: string
  category: string
  classification_override: string | null
}

interface Renovation {
  id: string
  name: string
  classification: string
  status: string
  start_date: string | null
  end_date: string | null
  claimable: boolean
  expenses: Expense[]
}

interface Property {
  id: string
  address: string
  suburb: string | null
  state: string | null
  purchase_date: string | null
  purchase_price: number | null
  renovations: Renovation[]
}

interface FinancialPositionViewProps {
  properties: Property[]
  financialYearStartMonth: number
  financialYearStartDay: number
}

function getFinancialYearStart(date: Date, fyMonth: number, fyDay: number): Date {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed

  let fyYear = year
  if (month < fyMonth || (month === fyMonth && date.getDate() < fyDay)) {
    fyYear = year - 1
  }

  return new Date(fyYear, fyMonth - 1, fyDay)
}

export function FinancialPositionView({ properties, financialYearStartMonth, financialYearStartDay }: FinancialPositionViewProps) {
  const today = new Date()
  const [asOfDate, setAsOfDate] = useState(today.toISOString().split("T")[0])
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set(properties.map((p) => p.id)))

  const asOf = useMemo(() => new Date(asOfDate + "T23:59:59"), [asOfDate])

  const fyStart = useMemo(
    () => getFinancialYearStart(asOf, financialYearStartMonth, financialYearStartDay),
    [asOf, financialYearStartMonth, financialYearStartDay]
  )

  const fyEnd = useMemo(() => {
    const end = new Date(fyStart)
    end.setFullYear(end.getFullYear() + 1)
    end.setDate(end.getDate() - 1)
    return end
  }, [fyStart])

  const propertyData = useMemo(() => {
    return properties.map((property) => {
      const claimableRenovations = property.renovations.filter((r) => r.claimable !== false)

      const allExpenses = claimableRenovations.flatMap((r) =>
        r.expenses.map((e) => ({
          ...e,
          renovation_classification: r.classification,
          effective_classification: e.classification_override ?? r.classification,
        }))
      )

      const expensesUpToAsOf = allExpenses.filter((e) => new Date(e.expense_date) <= asOf)
      const expensesInFY = expensesUpToAsOf.filter((e) => {
        const d = new Date(e.expense_date)
        return d >= fyStart && d <= asOf
      })

      const allTimeRepairs = expensesUpToAsOf.filter((e) => e.effective_classification === "repair").reduce((s, e) => s + Number(e.amount), 0)
      const allTimeCapital = expensesUpToAsOf.filter((e) => e.effective_classification === "capital_improvement").reduce((s, e) => s + Number(e.amount), 0)
      const allTimeTotal = expensesUpToAsOf.reduce((s, e) => s + Number(e.amount), 0)

      const fYRepairs = expensesInFY.filter((e) => e.effective_classification === "repair").reduce((s, e) => s + Number(e.amount), 0)
      const fYCapital = expensesInFY.filter((e) => e.effective_classification === "capital_improvement").reduce((s, e) => s + Number(e.amount), 0)
      const fYTotal = expensesInFY.reduce((s, e) => s + Number(e.amount), 0)

      const adjustedCostBase = (property.purchase_price ?? 0) + allTimeCapital
      const capitalGainIfSold = adjustedCostBase // placeholder — actual gain needs sale price

      // Renovation breakdown for the FY
      const renovationBreakdown = claimableRenovations.map((r) => {
        const rExpensesInFY = r.expenses.filter((e) => {
          const d = new Date(e.expense_date)
          return d >= fyStart && d <= asOf
        })
        const rTotal = rExpensesInFY.reduce((s, e) => s + Number(e.amount), 0)
        const rRepairs = rExpensesInFY.filter((e) => (e.classification_override ?? r.classification) === "repair").reduce((s, e) => s + Number(e.amount), 0)
        const rCapital = rExpensesInFY.filter((e) => (e.classification_override ?? r.classification) === "capital_improvement").reduce((s, e) => s + Number(e.amount), 0)
        return { ...r, fyTotal: rTotal, fyRepairs: rRepairs, fyCapital: rCapital }
      }).filter((r) => r.fyTotal > 0)

      return {
        property,
        allTimeRepairs,
        allTimeCapital,
        allTimeTotal,
        fYRepairs,
        fYCapital,
        fYTotal,
        adjustedCostBase,
        renovationBreakdown,
      }
    })
  }, [properties, asOf, fyStart])

  const portfolioTotals = useMemo(() => ({
    fYRepairs: propertyData.reduce((s, p) => s + p.fYRepairs, 0),
    fYCapital: propertyData.reduce((s, p) => s + p.fYCapital, 0),
    fYTotal: propertyData.reduce((s, p) => s + p.fYTotal, 0),
    allTimeCapital: propertyData.reduce((s, p) => s + p.allTimeCapital, 0),
    allTimeTotal: propertyData.reduce((s, p) => s + p.allTimeTotal, 0),
    totalPurchasePrice: properties.reduce((s, p) => s + (p.purchase_price ?? 0), 0),
    totalAdjustedCostBase: propertyData.reduce((s, p) => s + p.adjustedCostBase, 0),
  }), [propertyData, properties])

  function toggleProperty(id: string) {
    setExpandedProperties((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fyLabel = `FY${fyStart.getFullYear().toString().slice(2)}/${fyEnd.getFullYear().toString().slice(2)}`

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header + date picker */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Financial Position</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Tax classification summary and cost base tracker · {fyLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="asOfDate" className="text-sm whitespace-nowrap">Position as of</Label>
          <Input
            id="asOfDate"
            type="date"
            value={asOfDate}
            max={today.toISOString().split("T")[0]}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* FY info banner */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>
          Financial year: <strong>{formatDate(fyStart.toISOString())}</strong> → <strong>{formatDate(fyEnd.toISOString())}</strong>
          {" · "}Figures below show <strong>{fyLabel}</strong> spend up to <strong>{formatDate(asOfDate)}</strong>
        </span>
      </div>

      {/* Portfolio summary */}
      <div>
        <h2 className="text-base font-semibold mb-3">Portfolio summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-sky-600 mb-1.5">
                <Wrench className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Repairs {fyLabel}</span>
              </div>
              <p className="text-2xl font-bold text-sky-700">{formatCurrency(portfolioTotals.fYRepairs)}</p>
              <p className="text-xs text-muted-foreground mt-1">Potentially tax-deductible</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-amber-600 mb-1.5">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Capital {fyLabel}</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(portfolioTotals.fYCapital)}</p>
              <p className="text-xs text-muted-foreground mt-1">Added to cost bases</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">All-time capital</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(portfolioTotals.allTimeCapital)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total cost base additions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Portfolio cost base</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(portfolioTotals.totalAdjustedCostBase)}</p>
              <p className="text-xs text-muted-foreground mt-1">Purchase price + improvements</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Per-property breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Per-property breakdown</h2>

        {properties.length === 0 && (
          <p className="text-sm text-muted-foreground">No properties found. <Link href="/properties/new" className="underline">Add a property</Link> to get started.</p>
        )}

        {propertyData.map(({ property, allTimeRepairs, allTimeCapital, allTimeTotal, fYRepairs, fYCapital, fYTotal, adjustedCostBase, renovationBreakdown }) => {
          const isExpanded = expandedProperties.has(property.id)
          return (
            <Card key={property.id}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleProperty(property.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{property.address}</CardTitle>
                      {(property.suburb || property.state) && (
                        <p className="text-xs text-muted-foreground">{[property.suburb, property.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(fYTotal)} <span className="font-normal text-muted-foreground text-xs">{fyLabel}</span></p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(allTimeTotal)} all time</p>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-5">
                  <Separator />

                  {/* This FY stats */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">{fyLabel} (up to {formatDate(asOfDate)})</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-sky-50 p-3">
                        <p className="text-xs text-sky-600 font-medium">Repairs</p>
                        <p className="text-lg font-bold text-sky-700 mt-0.5">{formatCurrency(fYRepairs)}</p>
                        <p className="text-xs text-sky-600/70 mt-0.5">Tax-deductible</p>
                      </div>
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <p className="text-xs text-amber-600 font-medium">Capital improvements</p>
                        <p className="text-lg font-bold text-amber-700 mt-0.5">{formatCurrency(fYCapital)}</p>
                        <p className="text-xs text-amber-600/70 mt-0.5">Added to cost base</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground font-medium">Total spend</p>
                        <p className="text-lg font-bold mt-0.5">{formatCurrency(fYTotal)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Cost base */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Cost base (as of {formatDate(asOfDate)})</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purchase price</span>
                        <span className="font-medium">{formatCurrency(property.purchase_price)}</span>
                      </div>
                      {property.purchase_date && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Purchased</span>
                          <span>{formatDate(property.purchase_date)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">+ Capital improvements (all time)</span>
                        <span className="font-medium text-amber-700">+{formatCurrency(allTimeCapital)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Adjusted cost base</span>
                        <span>{formatCurrency(adjustedCostBase)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Repairs all-time: {formatCurrency(allTimeRepairs)} · Total all-time: {formatCurrency(allTimeTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Renovation breakdown for FY */}
                  {renovationBreakdown.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{fyLabel} renovations</p>
                      <div className="space-y-1.5">
                        {renovationBreakdown.map((r) => (
                          <Link
                            key={r.id}
                            href={`/properties/${property.id}/renovations/${r.id}`}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`inline-flex h-2 w-2 rounded-full shrink-0 ${r.classification === "capital_improvement" ? "bg-amber-400" : "bg-sky-400"}`} />
                              <span className="truncate">{r.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <span className="font-medium">{formatCurrency(r.fyTotal)}</span>
                              {r.fyRepairs > 0 && r.fyCapital > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(r.fyRepairs)} repair · {formatCurrency(r.fyCapital)} capital
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {renovationBreakdown.length === 0 && (
                    <p className="text-xs text-muted-foreground">No expenses in this financial year up to {formatDate(asOfDate)}.</p>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Tax guidance note */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <strong>Note:</strong> This is a record-keeping tool, not tax advice. Repair vs capital improvement classifications affect your tax position — consult a qualified tax professional or accountant to confirm how each item should be treated for your specific circumstances.
      </div>
    </div>
  )
}
