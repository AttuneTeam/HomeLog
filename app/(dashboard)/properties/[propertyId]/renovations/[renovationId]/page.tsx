import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, classificationLabel } from "@/lib/utils";
import { Plus, Pencil, Receipt } from "lucide-react";
import { DeleteRenovationButton } from "@/components/delete-renovation-button";
import { RenovationQuotesSection } from "@/components/renovation-quotes-section";
import { ManualTaxClassification } from "@/lib/supabase/database.types";

interface Props {
  params: Promise<{ propertyId: string; renovationId: string }>;
}

export default async function RenovationDetailPage({ params }: Props) {
  const { propertyId, renovationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: renovation } = await supabase
    .from("renovations")
    .select("*")
    .eq("id", renovationId)
    .single();

  if (!renovation) notFound();

  const { data: property } = await supabase
    .from("properties")
    .select("address")
    .eq("id", propertyId)
    .single();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("renovation_id", renovationId)
    .order("expense_date", { ascending: false });

  const { data: quotes } = await supabase
    .from("renovation_quotes")
    .select("*, quote_ai_classifications(*)")
    .eq("renovation_id", renovationId)
    .order("created_at", { ascending: false });

  const totalSpend = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  const expenseDates =
    expenses?.map((e) => e.expense_date).filter(Boolean) ?? [];
  const inferredStartDate = expenseDates.length
    ? expenseDates.reduce((a, b) => (a < b ? a : b))
    : null;
  const inferredEndDate = expenseDates.length
    ? expenseDates.reduce((a, b) => (a > b ? a : b))
    : null;

  const statusLabels: Record<string, string> = {
    planned: "Planned",
    in_progress: "In progress",
    completed: "Completed",
  };
  const statusColors: Record<string, string> = {
    planned: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
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
            <span>{renovation.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{renovation.name}</h1>
          {renovation.description && (
            <div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {renovation.description}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[renovation.status]}`}
            >
              {statusLabels[renovation.status]}
            </span>
            {renovation.claimable === false && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                Non-claimable
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <ButtonLink
            href={`/properties/${propertyId}/renovations/${renovationId}/edit`}
            variant="outline"
            size="sm"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </ButtonLink>
          <DeleteRenovationButton
            renovationId={renovationId}
            propertyId={propertyId}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-sm">
            <p className="text-xs text-muted-foreground">Start date</p>
            <p className="font-medium mt-1">
              {formatDate(inferredStartDate)} - {formatDate(inferredEndDate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-sm">
            <p className="text-xs text-muted-foreground">Total spend</p>
            <p className="font-semibold mt-1">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <ButtonLink
            href={`/properties/${propertyId}/renovations/${renovationId}/expenses/new`}
            size="sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add expense
          </ButtonLink>
        </div>

        {!expenses || expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
            <Receipt className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No expenses yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add invoices and costs for this renovation
              </p>
            </div>
            <ButtonLink
              href={`/properties/${propertyId}/renovations/${renovationId}/expenses/new`}
              variant="outline"
              size="sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add expense
            </ButtonLink>
          </div>
        ) : (
          <div className=" overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-0 py-2.5 font-medium text-muted-foreground">
                    Expense
                  </th>
                  <th className="text-left px-0 py-2.5 font-medium text-muted-foreground hidden sm:table-cell"></th>
                  <th className="text-left px-0 py-2.5 font-medium text-muted-foreground hidden sm:table-cell"></th>
                  <th className="text-right px-0 py-2.5 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-0 py-1">
                      <Link
                        href={`/properties/${propertyId}/renovations/${renovationId}/expenses/${expense.id}`}
                        className="hover:underline font-medium"
                      >
                        {expense.description ?? "Expense"}
                      </Link>
                      {expense.supplier && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          {expense.supplier}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                      {expense.manual_classification && (
                        <ClassificationBadge
                          classification={expense.manual_classification}
                        />
                      )}
                    </td>
                    <td className="text-left px-4 py-3 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-0 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(Number(expense.amount))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/50">
                  <td className="px-0 py-2.5 text-sm font-semibold text-right hidden sm:table-cell"></td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-right sm:table-cell"></td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-right sm:table-cell"></td>
                  <td className="px-0 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrency(totalSpend)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quotes */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RenovationQuotesSection
        renovationId={renovationId}
        userId={user.id}
        initialQuotes={(quotes ?? []) as any}
      />
    </div>
  );
}

function ClassificationBadge({
  classification,
}: {
  classification: ManualTaxClassification;
}) {
  const colours =
    classification === "Capital Works"
      ? "bg-amber-100 text-amber-800"
      : classification === "Immediate Repair"
        ? "bg-purple-100 text-purple-800"
        : "bg-sky-100 text-sky-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours} shrink-0`}
    >
      {classification === "Capital Works"
        ? "Capital Works"
        : classification === "Immediate Repair"
          ? "Immediate Repair"
          : "Repair"}
    </span>
  );
}
