import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaxReport } from "@/components/tax-report";
import type { TaxExpense, TaxReportData } from "@/components/tax-report";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function TaxReportPage({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch property
  const { data: property } = await supabase
    .from("properties")
    .select("id, address, suburb, state, postcode, purchase_date, purchase_price")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  // Fetch renovations with all expense fields
  const { data: renovations } = await supabase
    .from("renovations")
    .select(
      "id, name, classification, expenses(id, expense_date, supplier, abn, category, amount, gst_amount, description, invoice_path, classification_override)",
    )
    .eq("property_id", propertyId)
    .order("start_date", { ascending: true });

  // Fetch ROI calculator inputs (stamp duty, weekly rent, depreciation)
  const { data: roiInputs } = await supabase
    .from("roi_calculator_inputs")
    .select("stamp_duty, weekly_rent, div43_depreciation, div40_depreciation")
    .eq("user_id", user.id)
    .maybeSingle();

  // Resolve effective classification for each expense and generate signed URLs
  const repairs: TaxExpense[] = [];
  const initialRepairs: TaxExpense[] = [];
  const capitalImprovements: TaxExpense[] = [];

  for (const renovation of renovations ?? []) {
    for (const expense of renovation.expenses ?? []) {
      const effectiveClassification =
        expense.classification_override ?? renovation.classification;

      let invoice_url: string | null = null;
      if (expense.invoice_path) {
        const { data: signed } = await supabase.storage
          .from("invoices")
          .createSignedUrl(expense.invoice_path, 3600);
        invoice_url = signed?.signedUrl ?? null;
      }

      const taxExpense: TaxExpense = {
        id: expense.id,
        expense_date: expense.expense_date,
        supplier: expense.supplier,
        abn: (expense as { abn?: string | null }).abn ?? null,
        category: expense.category,
        amount: Number(expense.amount),
        gst_amount:
          (expense as { gst_amount?: number | null }).gst_amount != null
            ? Number((expense as { gst_amount?: number | null }).gst_amount)
            : null,
        description: expense.description,
        classification: effectiveClassification,
        invoice_url,
        renovation_name: renovation.name,
      };

      if (effectiveClassification === "capital_improvement") {
        capitalImprovements.push(taxExpense);
      } else if (effectiveClassification === "initial_repair") {
        initialRepairs.push(taxExpense);
      } else {
        repairs.push(taxExpense);
      }
    }
  }

  // Sort each group by date ascending
  const byDate = (a: TaxExpense, b: TaxExpense) =>
    a.expense_date.localeCompare(b.expense_date);
  repairs.sort(byDate);
  initialRepairs.sort(byDate);
  capitalImprovements.sort(byDate);

  const reportData: TaxReportData = {
    property,
    roiInputs: roiInputs ?? null,
    repairs,
    initialRepairs,
    capitalImprovements,
    generatedAt: new Date().toLocaleString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
        <Link href="/properties" className="hover:underline">
          Properties
        </Link>
        <span>/</span>
        <Link href={`/properties/${propertyId}`} className="hover:underline">
          {property.address}
        </Link>
        <span>/</span>
        <span>Tax Report</span>
      </div>

      <TaxReport data={reportData} />
    </div>
  );
}
