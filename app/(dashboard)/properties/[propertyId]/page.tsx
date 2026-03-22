import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, classificationLabel } from "@/lib/utils";
import {
  Plus,
  Pencil,
  MapPin,
  Calendar,
  DollarSign,
  Wrench,
  FileBarChart,
} from "lucide-react";
import { DeletePropertyButton } from "@/components/delete-property-button";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyDetailPage({ params }: Props) {
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

  const { data: renovations } = await supabase
    .from("renovations")
    .select("*, expenses(amount, classification_override)")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: false });

  const totalSpend =
    renovations?.reduce((sum, r) => {
      const rTotal =
        r.expenses?.reduce(
          (s: number, e: { amount: number }) => s + Number(e.amount),
          0,
        ) ?? 0;
      return sum + rTotal;
    }, 0) ?? 0;

  const capitalTotal =
    renovations?.reduce((sum, r) => {
      if (r.claimable === false) return sum
      const rTotal =
        r.expenses?.reduce(
          (
            s: number,
            e: { amount: number; classification_override: string | null },
          ) => {
            const cls = e.classification_override ?? r.classification;
            return cls === "capital_improvement" ? s + Number(e.amount) : s;
          },
          0,
        ) ?? 0;
      return sum + rTotal;
    }, 0) ?? 0;

  const adjustedCostBase = (property.purchase_price ?? 0) + capitalTotal;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/properties" className="hover:underline">
              Properties
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(property.suburb || property.state) && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {[property.suburb, property.state, property.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${property.property_type === "primary_residence" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>
              {property.property_type === "primary_residence" ? "Primary Residence" : "Investment"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <ButtonLink
            href={`/properties/${propertyId}/tax-report`}
            variant="outline"
            size="sm"
          >
            <FileBarChart className="h-3.5 w-3.5 mr-1.5" />
            Tax Report
          </ButtonLink>
          <ButtonLink
            href={`/properties/${propertyId}/edit`}
            variant="outline"
            size="sm"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </ButtonLink>
          <DeletePropertyButton propertyId={propertyId} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Purchased
            </p>
            <p className="font-semibold mt-1">
              {formatDate(property.purchase_date)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Purchase price
            </p>
            <p className="font-semibold mt-1">
              {formatCurrency(property.purchase_price)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Total spend
            </p>
            <p className="font-semibold mt-1">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Adjusted cost base</p>
            <p className="font-semibold mt-1">
              {formatCurrency(adjustedCostBase)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Renovations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Renovations</h2>
          <ButtonLink
            href={`/properties/${propertyId}/renovations/new`}
            size="sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add renovation
          </ButtonLink>
        </div>

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
          <div className="flex flex-col gap-3">
            {renovations.map((renovation) => {
              const rTotal =
                renovation.expenses?.reduce(
                  (s: number, e: { amount: number }) => s + Number(e.amount),
                  0,
                ) ?? 0;
              return (
                <Link
                  key={renovation.id}
                  href={`/properties/${propertyId}/renovations/${renovation.id}`}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {renovation.name}
                          </span>
                          <StatusBadge status={renovation.status} />
                          <ClassificationBadge
                            classification={renovation.classification}
                          />
                        </div>
                        {renovation.contractor && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Contractor: {renovation.contractor}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(renovation.start_date)}
                          {renovation.end_date
                            ? ` → ${formatDate(renovation.end_date)}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">
                          {formatCurrency(rTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {renovation.expenses?.length ?? 0} expense
                          {renovation.expenses?.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {property.notes && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-1.5">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {property.notes}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    planned: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  };
  const labels: Record<string, string> = {
    planned: "Planned",
    in_progress: "In progress",
    completed: "Completed",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ClassificationBadge({ classification }: { classification: string }) {
  const colours =
    classification === "capital_improvement"
      ? "bg-amber-100 text-amber-800"
      : classification === "initial_repair"
        ? "bg-purple-100 text-purple-800"
        : "bg-sky-100 text-sky-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours}`}
    >
      {classificationLabel(classification as "repair" | "capital_improvement" | "initial_repair")}
    </span>
  );
}
