import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Pencil, FileText } from "lucide-react";
import { DeleteExpenseButton } from "@/components/delete-expense-button";
import { InvoiceViewer } from "@/components/invoice-viewer";
import { AiTaxClassificationPanel } from "@/components/ai-tax-classification-panel";

interface Props {
  params: Promise<{
    propertyId: string;
    renovationId: string;
    expenseId: string;
  }>;
}

export default async function ExpenseDetailPage({ params }: Props) {
  const { propertyId, renovationId, expenseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .single();

  if (!expense) notFound();

  const { data: renovation } = await supabase
    .from("renovations")
    .select("name")
    .eq("id", renovationId)
    .single();

  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single();

  let invoiceUrl: string | null = null;
  if (expense.invoice_path) {
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(expense.invoice_path, 3600);
    invoiceUrl = data?.signedUrl ?? null;
  }

  const { data: aiClassification } = await supabase
    .from("expense_ai_classifications")
    .select(
      "classification, deduction_strategy, legal_citation, environmental_flag, confidence_score, created_at, model_used",
    )
    .eq("expense_id", expenseId)
    .maybeSingle();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 flex-wrap">
            <Link href="/properties" className="hover:underline">
              Properties
            </Link>
            <span>/</span>
            <Link
              href={`/properties/${propertyId}`}
              className="hover:underline"
            >
              {property?.address}
            </Link>
            <span>/</span>
            <Link
              href={`/properties/${propertyId}/renovations/${renovationId}`}
              className="hover:underline"
            >
              {renovation?.name}
            </Link>
            <span>/</span>
            <span>Expense</span>
          </div>
          <h1 className="text-2xl font-bold">
            {expense.description ?? "Expense"}
          </h1>
          <p className="text-3xl font-bold mt-2">
            {formatCurrency(Number(expense.amount))}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <ButtonLink
            href={`/properties/${propertyId}/renovations/${renovationId}/expenses/${expenseId}/edit`}
            variant="outline"
            size="sm"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </ButtonLink>
          <DeleteExpenseButton
            expenseId={expenseId}
            renovationId={renovationId}
            propertyId={propertyId}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium mt-1">
              {formatDate(expense.expense_date)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="font-medium mt-1">{expense.supplier ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <AiTaxClassificationPanel
        expenseId={expenseId}
        existingClassification={aiClassification ?? null}
        hasExtractedText={!!expense.raw_text}
        contextNotes={expense.context_notes ?? null}
      />

      {invoiceUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceViewer url={invoiceUrl} path={expense.invoice_path!} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
