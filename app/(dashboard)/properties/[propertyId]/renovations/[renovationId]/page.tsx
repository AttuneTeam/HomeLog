import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/button-link"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate, classificationLabel } from "@/lib/utils"
import { Plus, Pencil, Receipt } from "lucide-react"
import { DeleteRenovationButton } from "@/components/delete-renovation-button"

interface Props {
  params: Promise<{ propertyId: string; renovationId: string }>
}

export default async function RenovationDetailPage({ params }: Props) {
  const { propertyId, renovationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: renovation } = await supabase
    .from("renovations")
    .select("*")
    .eq("id", renovationId)
    .single()

  if (!renovation) notFound()

  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single()

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("renovation_id", renovationId)
    .order("expense_date", { ascending: false })

  const totalSpend = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0

  const statusLabels: Record<string, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed" }
  const statusColors: Record<string, string> = {
    planned: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  }
  const isCapital = renovation.classification === "capital_improvement"

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 flex-wrap">
            <Link href="/properties" className="hover:underline">Properties</Link>
            <span>/</span>
            <Link href={`/properties/${propertyId}`} className="hover:underline">{property?.address}</Link>
            <span>/</span>
            <span>{renovation.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{renovation.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[renovation.status]}`}>
              {statusLabels[renovation.status]}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isCapital ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
              {classificationLabel(renovation.classification)}
            </span>
            {renovation.claimable === false && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                Non-claimable
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <ButtonLink href={`/properties/${propertyId}/renovations/${renovationId}/edit`} variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </ButtonLink>
          <DeleteRenovationButton renovationId={renovationId} propertyId={propertyId} />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-sm"><p className="text-xs text-muted-foreground">Start date</p><p className="font-medium mt-1">{formatDate(renovation.start_date)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-sm"><p className="text-xs text-muted-foreground">End date</p><p className="font-medium mt-1">{formatDate(renovation.end_date)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-sm"><p className="text-xs text-muted-foreground">Contractor</p><p className="font-medium mt-1">{renovation.contractor ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-sm"><p className="text-xs text-muted-foreground">Total spend</p><p className="font-semibold mt-1">{formatCurrency(totalSpend)}</p></CardContent></Card>
      </div>

      {/* Expenses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <ButtonLink href={`/properties/${propertyId}/renovations/${renovationId}/expenses/new`} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add expense
          </ButtonLink>
        </div>

        {!expenses || expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
            <Receipt className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No expenses yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add invoices and costs for this renovation</p>
            </div>
            <ButtonLink href={`/properties/${propertyId}/renovations/${renovationId}/expenses/new`} variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add expense
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => {
              const effectiveClassification = expense.classification_override ?? renovation.classification
              const isExpenseCapital = effectiveClassification === "capital_improvement"
              const categoryLabels: Record<string, string> = {
                labour: "Labour", materials: "Materials", permits: "Permits",
                professional_fees: "Professional fees", appliances: "Appliances",
                fixtures: "Fixtures", other: "Other",
              }
              return (
                <Link key={expense.id} href={`/properties/${propertyId}/renovations/${renovationId}/expenses/${expense.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{expense.description ?? categoryLabels[expense.category]}</span>
                          {expense.classification_override && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isExpenseCapital ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                              Override: {classificationLabel(effectiveClassification as "repair" | "capital_improvement")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {categoryLabels[expense.category]} · {formatDate(expense.expense_date)}
                          {expense.supplier ? ` · ${expense.supplier}` : ""}
                          {expense.invoice_path ? " · 📎 Invoice" : ""}
                        </p>
                      </div>
                      <p className="font-semibold shrink-0">{formatCurrency(Number(expense.amount))}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
            <div className="flex justify-end pt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(totalSpend)}</p>
            </div>
          </div>
        )}
      </div>

      {(renovation.description || renovation.notes) && (
        <>
          <Separator />
          {renovation.description && (
            <div>
              <h3 className="text-sm font-medium mb-1.5">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{renovation.description}</p>
            </div>
          )}
          {renovation.notes && (
            <div>
              <h3 className="text-sm font-medium mb-1.5">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{renovation.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
