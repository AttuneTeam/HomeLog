import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ExpenseForm } from "@/components/expense-form"

interface Props {
  params: Promise<{ propertyId: string; renovationId: string; expenseId: string }>
}

export default async function EditExpensePage({ params }: Props) {
  const { propertyId, renovationId, expenseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .single()

  if (!expense) notFound()

  const { data: renovation } = await supabase
    .from("renovations")
    .select("name")
    .eq("id", renovationId)
    .single()

  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 flex-wrap">
          <Link href="/properties" className="hover:underline">Properties</Link>
          <span>/</span>
          <Link href={`/properties/${propertyId}`} className="hover:underline">{property?.address}</Link>
          <span>/</span>
          <Link href={`/properties/${propertyId}/renovations/${renovationId}`} className="hover:underline">{renovation?.name}</Link>
          <span>/</span>
          <span>Edit expense</span>
        </div>
        <h1 className="text-2xl font-bold">Edit expense</h1>
      </div>
      <ExpenseForm
        renovationId={renovationId}
        propertyId={propertyId}
        userId={user.id}
        defaultValues={{
          id: expense.id,
          amount: expense.amount.toString(),
          gst_amount: expense.gst_amount != null ? String(expense.gst_amount) : "",
          expense_date: expense.expense_date,
          description: expense.description ?? "",
          supplier: expense.supplier ?? "",
          abn: expense.abn ?? "",
          invoice_path: expense.invoice_path,
          context_notes: expense.context_notes ?? "",
        }}
      />
    </div>
  )
}
