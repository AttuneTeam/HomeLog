import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ExpenseForm } from "@/components/expense-form"

interface Props {
  params: Promise<{ propertyId: string; renovationId: string }>
}

export default async function NewExpensePage({ params }: Props) {
  const { propertyId, renovationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: renovation } = await supabase
    .from("renovations")
    .select("name, classification")
    .eq("id", renovationId)
    .single()

  if (!renovation) notFound()

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
          <Link href={`/properties/${propertyId}/renovations/${renovationId}`} className="hover:underline">{renovation.name}</Link>
          <span>/</span>
          <span>New expense</span>
        </div>
        <h1 className="text-2xl font-bold">Add expense</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Default classification: <strong>{renovation.classification === "capital_improvement" ? "Capital Improvement" : "Repair"}</strong> (inherited from renovation — override below if needed)
        </p>
      </div>
      <ExpenseForm
        renovationId={renovationId}
        propertyId={propertyId}
        renovationClassification={renovation.classification}
        userId={user.id}
      />
    </div>
  )
}
