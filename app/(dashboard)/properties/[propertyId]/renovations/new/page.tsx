import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RenovationForm } from "@/components/renovation-form"

interface Props {
  params: Promise<{ propertyId: string }>
}

export default async function NewRenovationPage({ params }: Props) {
  const { propertyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single()

  if (!property) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <Link href="/properties" className="hover:underline">Properties</Link>
          <span>/</span>
          <Link href={`/properties/${propertyId}`} className="hover:underline">{property.address}</Link>
          <span>/</span>
          <span>New renovation</span>
        </div>
        <h1 className="text-2xl font-bold">Add renovation</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track a renovation project for this property</p>
      </div>
      <RenovationForm propertyId={propertyId} />
    </div>
  )
}
