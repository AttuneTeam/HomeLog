import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BulkUploadDropzone } from "@/components/bulk-upload-dropzone";
import { ButtonLink } from "@/components/button-link";
import { ListChecks, Building2, Plus } from "lucide-react";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: properties } = await supabase
    .from("properties")
    .select("id, address")
    .order("created_at", { ascending: false });

  const { count: reviewCount } = await supabase
    .from("staged_receipts")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "extracting", "needs_review"]);

  const hasProperties = (properties ?? []).length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-caslon font-bold">Bulk import</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Drop a backlog of receipts and review them in one pass.
          </p>
        </div>
        {reviewCount ? (
          <ButtonLink href="/import/review" variant="outline">
            <ListChecks className="h-4 w-4 mr-1.5" />
            Review queue ({reviewCount})
          </ButtonLink>
        ) : null}
      </div>

      {hasProperties ? (
        <BulkUploadDropzone
          userId={user.id}
          properties={(properties ?? []).map((p) => ({ id: p.id, address: p.address }))}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center gap-3">
          <Building2 className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">Add a property first</p>
            <p className="text-muted-foreground text-sm mt-0.5">
              Bulk import adds receipts to a property, so you&apos;ll need one before you can upload.
            </p>
          </div>
          <ButtonLink href="/properties/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Add property
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
