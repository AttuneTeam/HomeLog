"use client";

import { useRef, useState, useTransition } from "react";
import { Info, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { upsertDepreciationReport } from "@/app/actions/depreciation-reports";
import type {
  DepreciationMethod,
  DepreciationReport,
} from "@/lib/supabase/database.types";

interface Props {
  propertyId: string;
  userId: string;
  financialYearEnd: number;
  financialYearLabel: string;
  report: DepreciationReport | null;
  /**
   * This year's Division 43 claim computed from the capital works register.
   * Shown for comparison — the surveyor's schedule normally supersedes it,
   * because it also covers construction the owner did not pay for.
   */
  registerCapitalWorks: number;
}

/**
 * Capture the depreciation figures from a quantity surveyor's schedule.
 *
 * Division 40 depends on per-asset effective lives, the choice of prime cost
 * versus diminishing value, and the post-9-May-2017 restriction on
 * previously-used plant in second-hand residential property. A surveyor
 * already determines all of that. The product records their figures and keeps
 * the report as evidence rather than re-deriving a determination it is not
 * placed to make.
 */
export function DepreciationReportPanel({
  propertyId,
  userId,
  financialYearEnd,
  financialYearLabel,
  report,
  registerCapitalWorks,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [div43, setDiv43] = useState(
    report?.div43_annual != null ? String(report.div43_annual) : "",
  );
  const [div40, setDiv40] = useState(
    report?.div40_annual != null ? String(report.div40_annual) : "",
  );
  const [qsFirm, setQsFirm] = useState(report?.qs_firm ?? "");
  const [method, setMethod] = useState<DepreciationMethod>(
    report?.depreciation_method ?? "diminishing_value",
  );
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasReport = report != null;
  const hasFile = report?.storage_path != null;

  function save(storagePath?: string | null) {
    const parse = (v: string) => (v.trim() === "" ? null : Number(v));
    const d43 = parse(div43);
    const d40 = parse(div40);
    if ((d43 != null && Number.isNaN(d43)) || (d40 != null && Number.isNaN(d40))) {
      toast.error("Please enter numbers only.");
      return;
    }
    startTransition(async () => {
      const { error } = await upsertDepreciationReport({
        propertyId,
        financialYearEnd,
        div43Annual: d43,
        div40Annual: d40,
        qsFirm: qsFirm.trim() || null,
        reportDate: report?.report_date ?? null,
        depreciationMethod: method,
        storagePath,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`Saved for ${financialYearLabel}.`);
      router.refresh();
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${userId}/${propertyId}/qs-reports/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("property-files")
        .upload(path, file);
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      save(path);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Depreciation schedule — {financialYearLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            {!hasReport && (
              <p>
                No depreciation schedule recorded. Plant and equipment
                (Division 40) is <strong>not tracked</strong> by Home Base — it
                depends on per-asset effective lives and the second-hand plant
                rules, which your quantity surveyor determines.
              </p>
            )}
            <p>
              <strong>Where to find these figures:</strong> your schedule has a
              year-by-year table, usually titled &ldquo;Schedule by diminishing
              value method&rdquo; and &ldquo;Schedule by prime cost
              method&rdquo;. Find the row whose financial year is{" "}
              <strong>{financialYearLabel}</strong> and read across.
            </p>
            <p>
              <strong>Capital works is the same on both pages</strong> —
              Division 43 can only be claimed on prime cost, so the method makes
              no difference to it. Only the plant and equipment column differs,
              which is what the method below records.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="div43">Capital works (Div 43)</Label>
            <Input
              id="div43"
              inputMode="decimal"
              placeholder="0.00"
              value={div43}
              onChange={(e) => setDiv43(e.target.value)}
            />
            {registerCapitalWorks > 0 && (
              <p className="text-xs text-muted-foreground">
                Your own works compute to{" "}
                {formatCurrency(registerCapitalWorks)}. A surveyor&apos;s figure
                is usually higher — it covers original construction too.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="div40">Decline in value (Div 40)</Label>
            <Input
              id="div40"
              inputMode="decimal"
              placeholder="0.00"
              value={div40}
              onChange={(e) => setDiv40(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Plant and equipment, per the schedule.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qs-firm">Quantity surveyor</Label>
            <Input
              id="qs-firm"
              placeholder="e.g. BMT"
              value={qsFirm}
              onChange={(e) => setQsFirm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dep-method">Division 40 method</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["diminishing_value", "Diminishing value"],
                ["prime_cost", "Prime cost"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={method === value ? "default" : "outline"}
                onClick={() => setMethod(value)}
                aria-pressed={method === value}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Which column of the schedule the plant and equipment figure came
            from. Diminishing value claims more in early years, prime cost
            spreads it evenly; both reach the same total. This is an election
            your accountant makes and it is locked in per asset — confirm it
            with them rather than guessing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => save()} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save for {financialYearLabel}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            {hasFile ? "Replace report" : "Attach report"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {hasFile
              ? "Report attached and included in the tax pack."
              : "The report ships with the pack as evidence."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
