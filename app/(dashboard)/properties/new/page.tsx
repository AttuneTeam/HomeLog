import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PropertyForm } from "@/components/property-form"

export default async function NewPropertyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add property</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Enter the details for your property</p>
      </div>
      <PropertyForm userId={user.id} />
    </div>
  )
}
