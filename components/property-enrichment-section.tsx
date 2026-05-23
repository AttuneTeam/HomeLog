"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Building2,
  Landmark,
  ScrollText,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  MapPin,
  Train,
  GraduationCap,
  Trees,
  Coffee,
  History,
  DollarSign,
  Home,
} from "lucide-react";

type SaleHistoryItem = {
  year: string | null;
  price: string | null;
  type: string | null;
  notes: string | null;
};

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

export type PropertyEnrichment = {
  year_built: number | null;
  architectural_style: string | null;
  heritage_listing: string | null;
  heritage_description: string | null;
  historical_context: string | null;
  notable_features: string[];
  image_urls: string[];
  sale_history: SaleHistoryItem[];
  suburb_profile: SuburbProfile | null;
  street_and_council_history: string | null;
  sources: { title: string; url: string }[];
  enriched_at: string;
};

interface Props {
  propertyId: string;
  initial: PropertyEnrichment | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-semibold mt-0.5 text-sm ${valueClass ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

export function PropertyEnrichmentSection({ propertyId, initial }: Props) {
  const [enrichment, setEnrichment] = useState<PropertyEnrichment | null>(initial);
  const [loading, setLoading] = useState(false);

  async function runEnrichment() {
    setLoading(true);
    try {
      const res = await fetch(`/api/enrich/${propertyId}`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Enrichment failed");
      }
      const { enrichment: data, image_urls } = await res.json();
      setEnrichment({ ...data, image_urls, enriched_at: new Date().toISOString() });
      toast.success("Property records enriched");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!enrichment) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
        </div>
        <div>
          <p className="font-semibold">Enrich from public records</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Search public databases, heritage registers, sale records, and suburb data to build a richer property story.
          </p>
        </div>
        <button
          type="button"
          onClick={runEnrichment}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "Searching public records…" : "Enrich property history"}
        </button>
      </div>
    );
  }

  const sp = enrichment.suburb_profile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold text-base">Public Records</h2>
          <span className="text-xs text-muted-foreground">
            via Tavily ·{" "}
            {new Date(enrichment.enriched_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={runEnrichment}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Re-enrich
        </button>
      </div>

      {/* Property stats */}
      {(enrichment.year_built || enrichment.architectural_style || enrichment.heritage_listing) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {enrichment.year_built && (
            <InfoCard icon={Building2} label="Year built" value={String(enrichment.year_built)} />
          )}
          {enrichment.architectural_style && (
            <InfoCard icon={ScrollText} label="Architectural style" value={enrichment.architectural_style} />
          )}
          {enrichment.heritage_listing && (
            <InfoCard
              icon={Landmark}
              label="Heritage listing"
              value={enrichment.heritage_listing}
              valueClass="text-amber-700"
            />
          )}
        </div>
      )}

      {/* Images */}
      {enrichment.image_urls.length > 0 && (
        <div>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" /> Images found online
            </span>
          </SectionLabel>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {enrichment.image_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Property image ${i + 1}`}
                  className="h-36 w-52 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = "none";
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Heritage */}
      {enrichment.heritage_description && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Landmark className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Heritage significance
            </p>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">{enrichment.heritage_description}</p>
        </div>
      )}

      {/* Property history */}
      {enrichment.historical_context && (
        <div>
          <SectionLabel>Property history</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground">{enrichment.historical_context}</p>
        </div>
      )}

      {/* Notable features — list */}
      {enrichment.notable_features.length > 0 && (
        <div>
          <SectionLabel>Notable features</SectionLabel>
          <ul className="space-y-1.5">
            {enrichment.notable_features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sale history */}
      {enrichment.sale_history.length > 0 && (
        <div>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" /> Sale history
            </span>
          </SectionLabel>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Year</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrichment.sale_history.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium tabular-nums">{s.year ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.price ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{s.type ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{s.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Street & council history */}
      {enrichment.street_and_council_history && (
        <div>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <History className="h-3 w-3" /> Street &amp; council history
            </span>
          </SectionLabel>
          <p className="text-sm leading-relaxed text-foreground">{enrichment.street_and_council_history}</p>
        </div>
      )}

      {/* Suburb report */}
      {sp && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Suburb Report</h3>
          </div>
          <div className="p-4 space-y-4">
            {sp.overview && (
              <p className="text-sm leading-relaxed">{sp.overview}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sp.distance_to_cbd && (
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Distance to CBD</p>
                    <p className="text-sm mt-0.5">{sp.distance_to_cbd}</p>
                  </div>
                </div>
              )}
              {sp.median_house_price && (
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Median house price</p>
                    <p className="text-sm mt-0.5">{sp.median_house_price}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sp.transport.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Train className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Transport</p>
                  </div>
                  <ul className="space-y-1">
                    {sp.transport.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sp.schools.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Schools</p>
                  </div>
                  <ul className="space-y-1">
                    {sp.schools.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sp.parks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Trees className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Parks &amp; recreation</p>
                  </div>
                  <ul className="space-y-1">
                    {sp.parks.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sp.dining_shopping && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Dining &amp; shopping</p>
                  </div>
                  <p className="text-sm">{sp.dining_shopping}</p>
                </div>
              )}
            </div>

            {sp.lifestyle && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                {sp.lifestyle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sources */}
      {enrichment.sources.length > 0 && (
        <div>
          <SectionLabel>Sources</SectionLabel>
          <div className="space-y-1">
            {enrichment.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
