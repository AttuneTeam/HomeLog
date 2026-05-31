import { notFound } from "next/navigation";
import Image from "next/image";
import { Building2, Layers, Landmark, BookOpen, Images } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import {
  PropertyHistoryTimeline,
  type TimelineEvent,
  type HistorySummary,
} from "@/components/property-history-timeline";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PassportPage({ params }: Props) {
  const { token } = await params;
  const admin = createAdminClient();

  // Resolve token
  const { data: link } = await admin
    .from("property_passport_links")
    .select("property_id, expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!link) notFound();

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F1EA] p-4">
        <div className="text-center space-y-2">
          <p className="font-grotesk font-medium text-[#030813]">This passport link has expired.</p>
          <p className="font-grotesk text-sm text-[#76777c]">
            Ask the property owner to generate a new link.
          </p>
        </div>
      </div>
    );
  }

  const propertyId = link.property_id;

  const [
    { data: property },
    { data: renovations },
    { data: enrichment },
  ] = await Promise.all([
    admin.from("properties").select("*").eq("id", propertyId).single(),
    admin
      .from("renovations")
      .select("*, expenses(id, description, expense_date, amount, category, supplier, abn, invoice_path, manual_classification)")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false }),
    admin
      .from("property_enrichment")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  if (!property) notFound();

  const events: TimelineEvent[] = [];

  if (property.purchase_date) {
    events.push({
      id: `purchase-${property.id}`,
      sortDate: property.purchase_date,
      displayDate: property.purchase_date,
      type: "purchase",
      title: "Property Acquired",
      subtitle: property.address,
      amount: null,
    });
  }

  for (const r of renovations ?? []) {
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
        valueSummary: null,
      }),
    );
    const earliestExpenseDate =
      expenses
        .map((e) => e.expenseDate)
        .filter(Boolean)
        .sort()[0] ?? null;
    const date = r.end_date ?? r.start_date ?? earliestExpenseDate ?? r.created_at;
    if (!date) continue;
    events.push({
      id: `renovation-${r.id}`,
      sortDate: date,
      displayDate: date,
      type: "renovation",
      title: r.name,
      subtitle: r.contractor ? `Contractor: ${r.contractor}` : null,
      amount: null,
      renovation: {
        id: r.id,
        contractor: r.contractor,
        classification: r.classification,
        description: r.description,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        notes: r.notes,
        valueSummary: null,
        expenses,
      },
    });
  }

  // Oldest first — tells the value story chronologically
  events.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const completedRenovations = (renovations ?? []).filter((r) => r.status === "completed");

  const summary: HistorySummary = {
    capitalInvested: 0,
    renovationsCompleted: completedRenovations.length,
    purchasePrice: 0,
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

  type SuburbProfile = {
    overview: string | null;
    distance_to_cbd: string | null;
    transport: string[];
    schools: string[];
    parks: string[];
    dining_shopping: string | null;
    lifestyle: string | null;
    median_house_price: string | null;
  };

  const notableFeatures = (enrichment?.notable_features ?? []) as string[];
  const saleHistory = (enrichment?.sale_history ?? []) as {
    year: string | null;
    price: string | null;
    type: string | null;
    notes: string | null;
  }[];
  const suburbProfile = (enrichment?.suburb_profile ?? null) as SuburbProfile | null;
  const streetHistory = enrichment?.street_and_council_history ?? null;

  const hasContextSection =
    enrichment &&
    (notableFeatures.length > 0 ||
      saleHistory.length > 0 ||
      suburbProfile !== null ||
      streetHistory !== null);

  return (
    <div className="min-h-screen bg-[#F4F1EA]">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-[#E2E2E2]"
        style={{
          backgroundColor: "rgba(251, 249, 249, 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="flex items-center h-16 px-4 md:px-16 max-w-[1280px] mx-auto gap-4">
          <Image
            src="/logo.png"
            alt="Home Base"
            width={160}
            height={125}
            className="h-8 w-auto"
          />
          <div className="h-4 w-px bg-[#E2E2E2]" />
          <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
            Property Passport
          </span>
        </nav>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 md:px-16 py-12 space-y-20">
        {/* Logo + address */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/logo.png"
            alt="Home Base"
            width={160}
            height={125}
            className="h-14 w-auto"
          />
          <div>
            <h1 className="font-caslon text-[32px] md:text-[48px] leading-tight text-[#030813]">
              {property.address}
            </h1>
            {property.suburb && (
              <p className="font-grotesk text-[16px] text-[#76777c] mt-1">
                {property.suburb}
              </p>
            )}
          </div>
        </div>

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

        {/* Section E: Character & Neighbourhood */}
        {hasContextSection && (
          <section>
            <div className="mb-12">
              <h2 className="font-caslon text-[32px] md:text-[48px] leading-tight text-[#030813] mb-2">
                Character &amp; Neighbourhood
              </h2>
              <p className="font-grotesk text-[16px] text-[#76777c]">
                Neighbourhood context and notable features for {property.address}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              {/* Left column: suburb profile */}
              <div className="space-y-8">
                {suburbProfile && (
                  <>
                    {suburbProfile.overview && (
                      <div>
                        <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                          Neighbourhood Profile
                        </p>
                        <p className="font-grotesk text-[15px] leading-relaxed text-[#1b1c1c]">
                          {suburbProfile.overview}
                        </p>
                      </div>
                    )}

                    {(suburbProfile.distance_to_cbd || suburbProfile.median_house_price) && (
                      <div className="grid grid-cols-2 gap-4">
                        {suburbProfile.distance_to_cbd && (
                          <div className="bg-white p-6 rounded-lg border border-[#E2E2E2] flex flex-col gap-2 hover:bg-[#fbf9f9] transition-colors duration-300">
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c6c6cc]">
                              Distance to CBD
                            </p>
                            <p className="font-grotesk text-[18px] text-[#1b1c1c] font-medium">
                              {suburbProfile.distance_to_cbd}
                            </p>
                          </div>
                        )}
                        {suburbProfile.median_house_price && (
                          <div className="bg-white p-6 rounded-lg border border-[#E2E2E2] flex flex-col gap-2 hover:bg-[#fbf9f9] transition-colors duration-300">
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c6c6cc]">
                              Median Price
                            </p>
                            <p className="font-grotesk text-[18px] text-[#1b1c1c] font-medium">
                              {suburbProfile.median_house_price}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {(suburbProfile.transport.length > 0 ||
                      suburbProfile.schools.length > 0 ||
                      suburbProfile.parks.length > 0) && (
                      <div className="grid grid-cols-1 gap-6">
                        {suburbProfile.transport.length > 0 && (
                          <div>
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                              Transport
                            </p>
                            <ul className="space-y-2">
                              {suburbProfile.transport.map((t, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="mt-[9px] h-1 w-1 rounded-full bg-[#76777c] flex-shrink-0" />
                                  <span className="font-grotesk text-[14px] text-[#1b1c1c] leading-relaxed">{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {suburbProfile.schools.length > 0 && (
                          <div>
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                              Schools
                            </p>
                            <ul className="space-y-2">
                              {suburbProfile.schools.map((s, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="mt-[9px] h-1 w-1 rounded-full bg-[#76777c] flex-shrink-0" />
                                  <span className="font-grotesk text-[14px] text-[#1b1c1c] leading-relaxed">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {suburbProfile.parks.length > 0 && (
                          <div>
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                              Parks &amp; Recreation
                            </p>
                            <ul className="space-y-2">
                              {suburbProfile.parks.map((p, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="mt-[9px] h-1 w-1 rounded-full bg-[#76777c] flex-shrink-0" />
                                  <span className="font-grotesk text-[14px] text-[#1b1c1c] leading-relaxed">{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {(suburbProfile.dining_shopping || suburbProfile.lifestyle) && (
                      <div className="space-y-6">
                        {suburbProfile.dining_shopping && (
                          <div>
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                              Dining &amp; Shopping
                            </p>
                            <p className="font-grotesk text-[14px] leading-relaxed text-[#1b1c1c]">
                              {suburbProfile.dining_shopping}
                            </p>
                          </div>
                        )}
                        {suburbProfile.lifestyle && (
                          <div>
                            <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                              Lifestyle
                            </p>
                            <p className="font-grotesk text-[14px] leading-relaxed text-[#1b1c1c]">
                              {suburbProfile.lifestyle}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right column: street history, notable features, sale records */}
              <div className="space-y-10">
                {streetHistory && (
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                      Street &amp; Council History
                    </p>
                    <p className="font-grotesk text-[15px] leading-relaxed text-[#1b1c1c]">
                      {streetHistory}
                    </p>
                  </div>
                )}

                {notableFeatures.length > 0 && (
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                      Notable Features
                    </p>
                    <ul className="space-y-2">
                      {notableFeatures.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-[9px] h-1 w-1 rounded-full bg-[#76777c] flex-shrink-0" />
                          <span className="font-grotesk text-[14px] text-[#1b1c1c] leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {saleHistory.length > 0 && (
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] mb-3">
                      Public Sale Records
                    </p>
                    <div className="rounded-lg border border-[#E2E2E2] overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E2E2E2]">
                            {["Year", "Price", "Type"].map((h) => (
                              <th
                                key={h}
                                className="text-left px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] bg-white"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E2E2]">
                          {saleHistory.map((s, i) => (
                            <tr key={i} className="bg-white hover:bg-[#fbf9f9] transition-colors duration-200">
                              <td className="px-4 py-3 font-grotesk text-[14px] font-medium text-[#030813] tabular-nums">
                                {s.year ?? "—"}
                              </td>
                              <td className="px-4 py-3 font-grotesk text-[14px] text-[#030813] tabular-nums">
                                {s.price ?? "—"}
                              </td>
                              <td className="px-4 py-3 font-grotesk text-[13px] text-[#76777c] capitalize">
                                {s.type ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Timeline */}
        <section>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-12 gap-4">
            <div>
              <h2 className="font-caslon text-[32px] md:text-[48px] leading-tight text-[#030813] mb-2">
                Evolution of the Residence
              </h2>
              <p className="font-grotesk text-[16px] text-[#76777c]">
                A chronological record of the property lifecycle for{" "}
                {property.address}.
              </p>
            </div>
            <div className="hidden md:block flex-shrink-0">
              <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] border-l border-[#E2E2E2] pl-4">
                Property Passport
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
        <div className="px-4 md:px-16 py-8 max-w-[1280px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="font-grotesk text-[12px] text-[#76777c]">
            © {new Date().getFullYear()} Home Base. All rights reserved.
          </p>
          <p className="font-grotesk text-[12px] text-[#76777c]">
            Financial amounts have been hidden from this public view.
          </p>
        </div>
      </footer>
    </div>
  );
}
