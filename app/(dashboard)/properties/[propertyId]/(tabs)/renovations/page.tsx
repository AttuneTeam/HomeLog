import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { Plus, Wrench, HardHat } from "lucide-react";
import { RenovationsList } from "@/components/renovations-list";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function RenovationsTab({ params }: Props) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .single();
  if (!property) notFound();

  const { data: renovations } = await supabase
    .from("renovations")
    .select(
      "*, expenses(id, description, expense_date, amount, manual_classification, supplier)",
    )
    .eq("property_id", propertyId)
    .order("start_date", { ascending: false });

  const renovationIds = (renovations ?? []).map((r) => r.id);
  const { data: expensesWithContractors } =
    renovationIds.length > 0
      ? await supabase
          .from("expenses")
          .select(
            "amount, contractor_id, contractors(id, name, abn, suburb, state, trade_category)",
          )
          .in("renovation_id", renovationIds)
          .not("contractor_id", "is", null)
      : { data: null };

  type ContractorSummary = {
    id: string;
    name: string;
    abn: string | null;
    suburb: string | null;
    state: string | null;
    trade_category: string | null;
    total: number;
  };
  type ExpenseWithContractor = {
    amount: number;
    contractor_id: string | null;
    contractors: Omit<ContractorSummary, "total"> | null;
  };
  const contractorMap = new Map<string, ContractorSummary>();
  for (const row of (expensesWithContractors ??
    []) as ExpenseWithContractor[]) {
    const c = row.contractors;
    if (!c) continue;
    if (!contractorMap.has(c.id)) contractorMap.set(c.id, { ...c, total: 0 });
    contractorMap.get(c.id)!.total += Number(row.amount);
  }
  const propertyContractors = Array.from(contractorMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-20">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Renovations</h2>
          </div>
          <ButtonLink
            href={`/properties/${propertyId}/renovations/new`}
            size="sm"
            variant="outline"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add renovation
          </ButtonLink>
        </div>
        <Separator className="mb-6" />

        {!renovations || renovations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center gap-3">
            <Wrench className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No renovations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Track your first renovation project
              </p>
            </div>
            <ButtonLink
              href={`/properties/${propertyId}/renovations/new`}
              variant="outline"
              size="sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add renovation
            </ButtonLink>
          </div>
        ) : (
          <RenovationsList renovations={renovations} propertyId={propertyId} />
        )}
      </div>

      {propertyContractors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <HardHat className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Contractors</h2>
            </div>
          </div>
          <Separator className="mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {propertyContractors.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-[#E2E2E2] bg-white p-4 space-y-1"
              >
                <p className="font-grotesk text-[14px] font-semibold text-[#030813]">
                  {c.name}
                </p>
                {c.trade_category && (
                  <p className="font-grotesk text-[12px] text-[#76777c]">
                    {c.trade_category}
                  </p>
                )}
                {(c.suburb || c.state) && (
                  <p className="font-grotesk text-[12px] text-[#76777c]">
                    {[c.suburb, c.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {c.abn && (
                  <p className="font-grotesk text-[11px] text-[#76777c]">
                    ABN {c.abn}
                  </p>
                )}
                <p className="font-grotesk text-[13px] font-medium text-[#030813] pt-1">
                  {formatCurrency(c.total)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
