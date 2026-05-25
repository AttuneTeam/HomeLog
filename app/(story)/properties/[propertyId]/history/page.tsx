import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Building2,
  Layers,
  Landmark,
  BookOpen,
  Images,
} from "lucide-react";
import {
  PropertyHistoryTimeline,
  type TimelineEvent,
  type HistorySummary,
} from "@/components/property-history-timeline";
import { EnrichTrigger } from "@/components/enrich-trigger";
import { EnrichmentEditor } from "@/components/enrichment-editor";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function PropertyStoryPage({ params }: Props) {
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

  const [{ data: renovations }, { data: enrichment }] = await Promise.all([
    supabase
      .from("renovations")
      .select(
        "*, expenses(id, description, expense_date, amount, category, supplier, abn, invoice_path, manual_classification)",
      )
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false }),
    supabase
      .from("property_enrichment")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  const events: TimelineEvent[] = [];

  if (property.purchase_date) {
    const total = (property.purchase_price ?? 0) + (property.stamp_duty ?? 0);
    events.push({
      id: `purchase-${property.id}`,
      sortDate: property.purchase_date,
      displayDate: property.purchase_date,
      type: "purchase",
      title: "Property Acquired",
      subtitle: property.address,
      amount: total > 0 ? total : null,
    });
  }

  for (const r of renovations ?? []) {
    const date = r.end_date ?? r.start_date ?? r.created_at;
    if (!date) continue;
    const expenses = (r.expenses ?? []).map(
      (e: {
        id: string;
        description: string | null;
        amount: number | string;
        category: string;
        supplier: string | null;
        abn: string | null;
        invoice_path: string | null;
        expense_date: string;
        manual_classification: string | null;
      }) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        category: e.category,
        supplier: e.supplier,
        abn: e.abn,
        invoicePath: e.invoice_path,
        expenseDate: e.expense_date,
        manualClassification: e.manual_classification,
      }),
    );
    const totalCost = expenses.reduce(
      (s: number, e: { amount: number }) => s + e.amount,
      0,
    );
    events.push({
      id: `renovation-${r.id}`,
      sortDate: date,
      displayDate: date,
      type: "renovation",
      title: r.name,
      subtitle: r.contractor ? `Contractor: ${r.contractor}` : null,
      amount: totalCost > 0 ? totalCost : null,
      renovation: {
        id: r.id,
        contractor: r.contractor,
        classification: r.classification,
        description: r.description,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        notes: r.notes,
        expenses,
      },
    });
  }

  events.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const completedRenovations = (renovations ?? []).filter(
    (r) => r.status === "completed",
  );
  const capitalInvested = completedRenovations.reduce((sum, r) => {
    return (
      sum +
      (r.expenses?.reduce(
        (s: number, e: { amount: number | string }) => s + Number(e.amount),
        0,
      ) ?? 0)
    );
  }, 0);

  const summary: HistorySummary = {
    capitalInvested,
    renovationsCompleted: completedRenovations.length,
    purchasePrice: property.purchase_price ?? 0,
    purchaseYear: property.purchase_date
      ? new Date(property.purchase_date).getFullYear()
      : null,
  };

  const hasAtAGlance =
    enrichment &&
    (enrichment.year_built ||
      enrichment.architectural_style ||
      enrichment.heritage_listing);

  const imageUrls: string[] =
    enrichment && Array.isArray(enrichment.image_urls)
      ? enrichment.image_urls
      : [];

  const hasHeritage =
    enrichment &&
    (enrichment.heritage_description || enrichment.historical_context);

  return (
    <div className="min-h-screen bg-[#F4F1EA]">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-50 border-b border-[#E2E2E2]"
        style={{
          backgroundColor: "rgba(251, 249, 249, 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="flex items-center h-16 px-4 md:px-16 max-w-[1280px] mx-auto gap-4">
          <Link
            href="/properties"
            className="flex items-center gap-2 font-grotesk text-[14px] font-medium text-[#45474c] hover:text-[#030813] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Properties</span>
          </Link>
          <div className="hidden sm:block h-4 w-px bg-[#E2E2E2]" />
          <h1 className="font-caslon text-[18px] md:text-[24px] text-[#030813] truncate flex-1 min-w-0">
            {property.address}
          </h1>
          {enrichment && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <EnrichmentEditor
                propertyId={propertyId}
                initial={{
                  year_built: enrichment.year_built,
                  architectural_style: enrichment.architectural_style,
                  heritage_listing: enrichment.heritage_listing,
                  heritage_description: enrichment.heritage_description,
                  historical_context: enrichment.historical_context,
                  notable_features: (enrichment.notable_features ?? []) as string[],
                  image_urls: (enrichment.image_urls ?? []) as string[],
                  sale_history: (enrichment.sale_history ?? []) as { year: string | null; price: string | null; type: string | null; notes: string | null }[],
                  suburb_profile: enrichment.suburb_profile as import("@/components/enrichment-editor").EnrichmentDraft["suburb_profile"],
                  street_and_council_history: enrichment.street_and_council_history,
                  sources: (enrichment.sources ?? []) as { title: string; url: string }[],
                }}
              />
              <div className="w-px h-4 bg-[#E2E2E2]" />
              <EnrichTrigger propertyId={propertyId} hasEnrichment={true} />
            </div>
          )}
        </nav>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-12 space-y-20">
        {/* Section A: At a Glance */}
        {hasAtAGlance && (
          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {enrichment.year_built && (
                <div className="bg-white p-8 rounded-lg border border-[#E2E2E2] flex flex-col gap-4 hover:bg-[#fbf9f9] transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <Building2 className="w-5 h-5 text-[#76777c]" />
                    <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
                      AT A GLANCE
                    </span>
                  </div>
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c6c6cc] mb-2">
                      Year Built
                    </p>
                    <p className="font-caslon text-[48px] leading-tight text-[#030813]">
                      {enrichment.year_built}
                    </p>
                  </div>
                </div>
              )}
              {enrichment.architectural_style && (
                <div className="bg-white p-8 rounded-lg border border-[#E2E2E2] flex flex-col gap-4 hover:bg-[#fbf9f9] transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <Layers className="w-5 h-5 text-[#76777c]" />
                    <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
                      AESTHETIC
                    </span>
                  </div>
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c6c6cc] mb-2">
                      Architectural Style
                    </p>
                    <p className="font-grotesk text-[18px] text-[#1b1c1c] leading-relaxed">
                      {enrichment.architectural_style}
                    </p>
                  </div>
                </div>
              )}
              {enrichment.heritage_listing && (
                <div className="bg-white p-8 rounded-lg border border-[#E2E2E2] flex flex-col gap-4 hover:bg-[#fbf9f9] transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <Landmark className="w-5 h-5 text-[#76777c]" />
                    <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
                      DESIGNATION
                    </span>
                  </div>
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c6c6cc] mb-2">
                      Heritage Listing
                    </p>
                    <p className="font-grotesk text-[18px] text-[#775a19] font-bold leading-relaxed">
                      {enrichment.heritage_listing}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section B: Image Gallery */}
        {imageUrls.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Images className="w-5 h-5 text-[#76777c]" />
              <h3 className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
                Images Found Online
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-auto md:h-[500px]">
              <div className="md:col-span-7 h-[300px] md:h-full overflow-hidden rounded-lg border border-[#E2E2E2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrls[0]}
                  alt="Property exterior"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                />
              </div>
              {imageUrls.length > 1 && (
                <div className="md:col-span-5 grid grid-rows-2 gap-4 h-[300px] md:h-full">
                  {imageUrls.slice(1, 3).map((url, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg border border-[#E2E2E2]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Property view ${i + 2}`}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section C: Heritage Significance */}
        {hasHeritage && imageUrls.length > 0 && (
          <section className="rounded-lg overflow-hidden relative min-h-[450px] flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrls[0]}
              alt="Heritage context"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(3, 8, 19, 0.82)",
                backdropFilter: "blur(2px)",
              }}
            />
            <div className="relative z-10 max-w-3xl px-8 md:px-12 py-16 text-white">
              <div className="flex items-center gap-2 mb-6 text-[#ffdea5]">
                <BookOpen className="w-5 h-5" />
                <h2 className="font-grotesk text-[11px] font-bold uppercase tracking-[0.1em]">
                  Heritage Significance
                </h2>
              </div>
              {enrichment!.heritage_description && (
                <>
                  <p className="font-caslon text-[24px] md:text-[32px] italic mb-8 leading-tight text-white">
                    &ldquo;{enrichment!.heritage_description}&rdquo;
                  </p>
                  <div className="w-12 h-0.5 bg-[#ffdea5] mb-8" />
                </>
              )}
              {enrichment!.historical_context && (
                <p className="font-grotesk text-[18px] leading-loose max-w-2xl text-white/80">
                  {enrichment!.historical_context}
                </p>
              )}
            </div>
            <div className="absolute bottom-0 right-0 p-8 opacity-10">
              <Landmark className="w-40 h-40 text-white" />
            </div>
          </section>
        )}

        {/* Enrichment CTA — shown only when no enrichment data exists */}
        {!enrichment && (
          <section>
            <EnrichTrigger propertyId={propertyId} hasEnrichment={false} />
          </section>
        )}

        {/* Section D: Evolution of the Residence */}
        <section>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-12 gap-4">
            <div>
              <h2 className="font-caslon text-[32px] md:text-[48px] leading-tight text-[#030813] mb-2">
                Evolution of the Residence
              </h2>
              <p className="font-grotesk text-[16px] text-[#76777c]">
                A chronological record of the property lifecycle{" "}
                {property.address}.
              </p>
            </div>
            <div className="hidden md:block flex-shrink-0">
              <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] border-l border-[#E2E2E2] pl-4">
                Asset Value History Tracking
              </span>
            </div>
          </div>
          <PropertyHistoryTimeline events={events} summary={summary} />
        </section>
      </main>

      <footer
        className="w-full mt-20 border-t border-[#E2E2E2]"
        style={{ backgroundColor: "#efeded" }}
      >
        <div className="px-4 md:px-16 py-8 max-w-[1280px] mx-auto">
          <p className="font-grotesk text-[12px] text-[#76777c]">
            © {new Date().getFullYear()} Home Base. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
