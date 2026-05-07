import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, calcTotalSpend } from "@/lib/utils";
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
import { PropertyFilesSection } from "@/components/property-files-section";
import { RentalPeriodsSection } from "@/components/rental-periods-section";
import { RenovationsList } from "@/components/renovations-list";

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

  const [
    { data: renovations },
    { data: propertyFiles },
    { data: rentalPeriods },
  ] = await Promise.all([
    supabase
      .from("renovations")
      .select(
        "*, expenses(id, description, expense_date, amount, manual_classification, supplier)",
      )
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false }),
    supabase
      .from("property_files")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("rental_periods")
      .select("*")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: true }),
  ]);

  const totalSpend = calcTotalSpend(renovations ?? []);

  const capitalTotal =
    renovations?.reduce((sum, r) => {
      if (r.status === "planned" || r.claimable === false) return sum;
      const rTotal =
        r.expenses?.reduce(
          (
            s: number,
            e: { amount: number; manual_classification: string | null },
          ) => {
            const cls = e.manual_classification;
            return cls === "Capital Works" ? s + Number(e.amount) : s;
          },
          0,
        ) ?? 0;
      return sum + rTotal;
    }, 0) ?? 0;

  const adjustedCostBase =
    (property.purchase_price ?? 0) + (property.stamp_duty ?? 0) + capitalTotal;

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
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${property.property_type === "primary_residence" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}
            >
              {property.property_type === "primary_residence"
                ? "Primary Residence"
                : "Investment"}
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
          <CardContent>
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
          <CardContent>
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
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Total spend
            </p>
            <p className="font-semibold mt-1">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Adjusted cost base</p>
            <p className="font-semibold mt-1">
              {formatCurrency(adjustedCostBase)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Files */}
      <Separator />
      <PropertyFilesSection
        propertyId={propertyId}
        userId={user.id}
        initialFiles={propertyFiles ?? []}
      />

      {/* Rental Periods */}
      <Separator />
      <RentalPeriodsSection
        propertyId={propertyId}
        initialPeriods={rentalPeriods ?? []}
      />

      {/* Renovations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Renovations</h2>
          <ButtonLink
            href={`/properties/${propertyId}/renovations/new`}
            size="sm"
            variant="outline"
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
          <RenovationsList renovations={renovations} propertyId={propertyId} />
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

