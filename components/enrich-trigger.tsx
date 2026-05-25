"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  propertyId: string;
  hasEnrichment: boolean;
}

export function EnrichTrigger({ propertyId, hasEnrichment }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function runEnrichment() {
    setLoading(true);
    try {
      const res = await fetch(`/api/enrich/${propertyId}`, { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Enrichment failed");
      }
      toast.success("Property records enriched");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!hasEnrichment) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[#E2E2E2] p-12 text-center space-y-4 bg-white">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0edff]">
            <Sparkles className="h-6 w-6 text-violet-600" />
          </div>
        </div>
        <div>
          <p className="font-grotesk text-[16px] font-semibold text-[#030813]">
            Enrich from public records
          </p>
          <p className="font-grotesk text-[14px] text-[#76777c] mt-1 max-w-sm mx-auto leading-relaxed">
            Search public databases, heritage registers, sale records, and
            suburb data to build a richer property story.
          </p>
        </div>
        <button
          type="button"
          onClick={runEnrichment}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#030813] px-5 py-2.5 font-grotesk text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Searching public records…" : "Enrich property history"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={runEnrichment}
      disabled={loading}
      className="inline-flex items-center gap-1.5 font-grotesk text-[12px] text-[#76777c] hover:text-[#030813] transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Searching…" : "Re-enrich"}
    </button>
  );
}
