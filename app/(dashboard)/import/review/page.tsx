import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import {
  ReviewQueue,
  type ReviewReceipt,
  type RenovationOption,
  type PropertyOption,
} from "@/components/import-review-queue";
import { Upload } from "lucide-react";

export default async function ImportReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: receipts } = await supabase
    .from("staged_receipts")
    .select(
      "id, original_filename, status, extracted, confidence, error, renovation_id, property_id, properties(address)",
    )
    .in("status", ["pending", "extracting", "needs_review", "failed"])
    .order("created_at", { ascending: true });

  const { data: renovations } = await supabase
    .from("renovations")
    .select("id, name, property_id, status")
    .order("created_at", { ascending: false });

  const { data: properties } = await supabase
    .from("properties")
    .select("id, address")
    .order("created_at", { ascending: false });

  const renovationOptions: RenovationOption[] = (renovations ?? []).map((r) => ({
    id: r.id,
    propertyId: r.property_id,
    name: r.name,
    status: r.status,
  }));

  const propertyOptions: PropertyOption[] = (properties ?? []).map((p) => ({
    id: p.id,
    address: p.address,
  }));

  const receiptData: ReviewReceipt[] = (receipts ?? []).map((r) => ({
    id: r.id,
    original_filename: r.original_filename,
    status: r.status as ReviewReceipt["status"],
    extracted: r.extracted as ReviewReceipt["extracted"],
    confidence: r.confidence,
    error: r.error,
    renovation_id: r.renovation_id,
    property_id: r.property_id,
    property_address: (r.properties as { address: string } | null)?.address ?? null,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-caslon font-bold">Review imported receipts</h1>
          <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
            Each receipt becomes an expense filed under a renovation. Receipts are grouped by
            property below — for each one, choose (or type to create) the renovation it belongs to.
            A new renovation also takes a status. Edit any field inline, then commit.
          </p>
        </div>
        <ButtonLink href="/import" variant="outline">
          <Upload className="h-4 w-4 mr-1.5" />
          Import more
        </ButtonLink>
      </div>

      <ReviewQueue
        initialReceipts={receiptData}
        renovations={renovationOptions}
        properties={propertyOptions}
      />
    </div>
  );
}
