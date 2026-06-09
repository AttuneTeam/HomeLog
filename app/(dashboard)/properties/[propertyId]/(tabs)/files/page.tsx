import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StickyNote } from "lucide-react";
import { PropertyFilesSection } from "@/components/property-files-section";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function FilesTab({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("id, notes")
    .eq("id", propertyId)
    .single();
  if (!property) notFound();

  const { data: propertyFiles } = await supabase
    .from("property_files")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <PropertyFilesSection
        propertyId={propertyId}
        userId={user.id}
        initialFiles={propertyFiles ?? []}
      />

      {property.notes && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Notes</h2>
          </div>
          <Separator className="mb-6" />
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {property.notes}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
