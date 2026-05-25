"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

export type EnrichmentDraft = {
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
};

interface Props {
  propertyId: string;
  initial: EnrichmentDraft;
}

// ── helpers ────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-3">
      {children}
    </h3>
  );
}

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
        className="w-full"
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Add item
      </Button>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export function EnrichmentEditor({ propertyId, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EnrichmentDraft>(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function set<K extends keyof EnrichmentDraft>(key: K, value: EnrichmentDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setSuburb<K extends keyof SuburbProfile>(key: K, value: SuburbProfile[K]) {
    setDraft((d) => ({
      ...d,
      suburb_profile: { ...(d.suburb_profile ?? emptySuburb()), [key]: value },
    }));
  }

  function setSaleRow(i: number, key: keyof SaleHistoryItem, value: string) {
    setDraft((d) => {
      const rows = [...d.sale_history];
      rows[i] = { ...rows[i], [key]: value || null };
      return { ...d, sale_history: rows };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/enrich/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Save failed");
      }
      toast.success("Changes saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const sp = draft.suburb_profile ?? emptySuburb();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-grotesk text-[12px] text-[#76777c] hover:text-[#030813] transition-colors"
          />
        }
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b flex-shrink-0">
          <DialogTitle>Edit enrichment data</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* Property details */}
          <div>
            <SectionHeading>Property details</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Year built</FieldLabel>
                <Input
                  type="number"
                  value={draft.year_built ?? ""}
                  onChange={(e) =>
                    set("year_built", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="e.g. 1920"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Architectural style</FieldLabel>
                <Input
                  value={draft.architectural_style ?? ""}
                  onChange={(e) => set("architectural_style", e.target.value || null)}
                  placeholder="e.g. Edwardian bungalow"
                />
              </div>
            </div>
          </div>

          {/* Heritage */}
          <div>
            <SectionHeading>Heritage</SectionHeading>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Heritage listing</FieldLabel>
                <Input
                  value={draft.heritage_listing ?? ""}
                  onChange={(e) => set("heritage_listing", e.target.value || null)}
                  placeholder="e.g. Victorian Heritage Register"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Heritage description</FieldLabel>
                <Textarea
                  value={draft.heritage_description ?? ""}
                  onChange={(e) => set("heritage_description", e.target.value || null)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <SectionHeading>History</SectionHeading>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Historical context</FieldLabel>
                <Textarea
                  value={draft.historical_context ?? ""}
                  onChange={(e) => set("historical_context", e.target.value || null)}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Street &amp; council history</FieldLabel>
                <Textarea
                  value={draft.street_and_council_history ?? ""}
                  onChange={(e) =>
                    set("street_and_council_history", e.target.value || null)
                  }
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Notable features */}
          <div>
            <SectionHeading>Notable features</SectionHeading>
            <StringListEditor
              items={draft.notable_features}
              onChange={(v) => set("notable_features", v)}
              placeholder="e.g. Original tessellated tile entrance"
            />
          </div>

          {/* Sale history */}
          <div>
            <SectionHeading>Sale history</SectionHeading>
            <div className="space-y-2">
              {draft.sale_history.map((row, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 items-start">
                  <Input
                    value={row.year ?? ""}
                    placeholder="Year"
                    onChange={(e) => setSaleRow(i, "year", e.target.value)}
                  />
                  <Input
                    value={row.price ?? ""}
                    placeholder="Price"
                    onChange={(e) => setSaleRow(i, "price", e.target.value)}
                  />
                  <Input
                    value={row.type ?? ""}
                    placeholder="Type"
                    onChange={(e) => setSaleRow(i, "type", e.target.value)}
                  />
                  <Input
                    value={row.notes ?? ""}
                    placeholder="Notes"
                    onChange={(e) => setSaleRow(i, "notes", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      set("sale_history", draft.sale_history.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {draft.sale_history.length > 0 && (
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 px-1">
                  {["Year", "Price", "Type", "Notes", ""].map((h) => (
                    <p key={h} className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </p>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set("sale_history", [
                    ...draft.sale_history,
                    { year: null, price: null, type: null, notes: null },
                  ])
                }
                className="w-full"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add sale
              </Button>
            </div>
          </div>

          {/* Suburb profile */}
          <div>
            <SectionHeading>Suburb profile</SectionHeading>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Overview</FieldLabel>
                <Textarea
                  value={sp.overview ?? ""}
                  onChange={(e) => setSuburb("overview", e.target.value || null)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Distance to CBD</FieldLabel>
                  <Input
                    value={sp.distance_to_cbd ?? ""}
                    onChange={(e) => setSuburb("distance_to_cbd", e.target.value || null)}
                    placeholder="e.g. 8km, 20 min by train"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Median house price</FieldLabel>
                  <Input
                    value={sp.median_house_price ?? ""}
                    onChange={(e) =>
                      setSuburb("median_house_price", e.target.value || null)
                    }
                    placeholder="e.g. $1.2M"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Transport</FieldLabel>
                <StringListEditor
                  items={sp.transport}
                  onChange={(v) => setSuburb("transport", v)}
                  placeholder="e.g. Glen Waverley line from Huntingdale"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Schools</FieldLabel>
                <StringListEditor
                  items={sp.schools}
                  onChange={(v) => setSuburb("schools", v)}
                  placeholder="e.g. Melbourne High School"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Parks &amp; recreation</FieldLabel>
                <StringListEditor
                  items={sp.parks}
                  onChange={(v) => setSuburb("parks", v)}
                  placeholder="e.g. Princes Park"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Dining &amp; shopping</FieldLabel>
                <Textarea
                  value={sp.dining_shopping ?? ""}
                  onChange={(e) => setSuburb("dining_shopping", e.target.value || null)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Lifestyle</FieldLabel>
                <Textarea
                  value={sp.lifestyle ?? ""}
                  onChange={(e) => setSuburb("lifestyle", e.target.value || null)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div>
            <SectionHeading>Image URLs</SectionHeading>
            <StringListEditor
              items={draft.image_urls}
              onChange={(v) => set("image_urls", v)}
              placeholder="https://…"
            />
          </div>

          {/* Sources */}
          <div>
            <SectionHeading>Sources</SectionHeading>
            <div className="space-y-2">
              {draft.sources.map((src, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={src.title}
                    placeholder="Title"
                    onChange={(e) => {
                      const next = [...draft.sources];
                      next[i] = { ...next[i], title: e.target.value };
                      set("sources", next);
                    }}
                  />
                  <Input
                    value={src.url}
                    placeholder="URL"
                    onChange={(e) => {
                      const next = [...draft.sources];
                      next[i] = { ...next[i], url: e.target.value };
                      set("sources", next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      set("sources", draft.sources.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("sources", [...draft.sources, { title: "", url: "" }])}
                className="w-full"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add source
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0" showCloseButton={false}>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptySuburb(): SuburbProfile {
  return {
    overview: null,
    distance_to_cbd: null,
    transport: [],
    schools: [],
    parks: [],
    dining_shopping: null,
    lifestyle: null,
    median_house_price: null,
  };
}
