import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PropertyForm } from "@/components/property-form";
import Link from "next/link";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function EditPropertyPage({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <Link href="/properties" className="hover:underline">
            Properties
          </Link>
          <span>/</span>
          <Link href={`/properties/${propertyId}`} className="hover:underline">
            {property.address}
          </Link>
          <span>/</span>
          <span>Edit</span>
        </div>
        <h1 className="text-2xl font-bold">Edit property</h1>
      </div>
      <PropertyForm
        userId={user.id}
        defaultValues={{
          id: property.id,
          address: property.address,
          suburb: property.suburb ?? "",
          state: property.state ?? "",
          postcode: property.postcode ?? "",
          purchase_date: property.purchase_date ?? "",
          purchase_price: property.purchase_price?.toString() ?? "",
          notes: property.notes ?? "",
          property_type:
            (property.property_type as "investment" | "primary_residence") ??
            "investment",
        }}
      />
    </div>
  );
}
