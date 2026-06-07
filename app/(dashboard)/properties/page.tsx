import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ButtonLink } from "@/components/button-link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, MapPin, Calendar, Users } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function PropertiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const userId = user.id

  const { data: properties } = await supabase
    .from("properties")
    .select("*, profiles!properties_user_id_fkey(display_name)")
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-caslon font-bold">Properties</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your investment properties</p>
        </div>
        <ButtonLink href="/properties/new">
          <Plus className="h-4 w-4 mr-1.5" />
          Add property
        </ButtonLink>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center gap-3">
          <Building2 className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No properties yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first property to get started</p>
          </div>
          <ButtonLink href="/properties/new" variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add property
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{property.address}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {property.user_id !== userId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                          <Users className="h-3 w-3" />
                          Shared by{" "}
                          {(
                            property as typeof property & {
                              profiles: { display_name: string | null } | null;
                            }
                          ).profiles?.display_name ?? "someone"}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${property.property_type === "primary_residence" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {property.property_type === "primary_residence" ? "Primary" : "Investment"}
                      </span>
                    </div>
                  </div>
                  {(property.suburb || property.state) && (
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[property.suburb, property.state, property.postcode].filter(Boolean).join(", ")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Purchase price</p>
                    <p className="font-medium">{formatCurrency(property.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Purchased
                    </p>
                    <p className="font-medium">{formatDate(property.purchase_date)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
