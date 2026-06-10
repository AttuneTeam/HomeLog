"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  commitStagedReceipt,
  dismissStagedReceipt,
  setStagedReceiptsProperty,
} from "@/app/actions/staged-receipts";
import { createRenovation } from "@/app/actions/renovations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText, AlertCircle, Trash2 } from "lucide-react";

// Local copy of the public.expense_category enum — avoids bundling the AI lib
// (which re-exports it alongside `generateObject`) into the client. The dropdown
// is gone from the UI; the AI-inferred category is committed, defaulting to
// "labour" when absent/invalid.
const CATEGORIES = [
  "labour",
  "materials",
  "permits",
  "professional_fees",
  "appliances",
  "fixtures",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const COMMIT_CONCURRENCY = 4;

// public.renovation_status — the status applied to the renovation each receipt
// lands on. Defaults to "completed" since bulk imports are usually historical.
const RENO_STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "planned", label: "Planned" },
] as const;
type RenoStatus = (typeof RENO_STATUSES)[number]["value"];

export interface RenovationOption {
  id: string;
  propertyId: string;
  name: string;
  status: string;
}

export interface PropertyOption {
  id: string;
  address: string;
}

interface ExtractedFields {
  amount: number | null;
  gst_amount: number | null;
  expense_date: string | null;
  description: string | null;
  supplier: string | null;
  abn: string | null;
  category: string | null;
  trade: string | null;
  raw_text: string | null;
  contractor_phone: string | null;
  contractor_email: string | null;
  contractor_website: string | null;
  contractor_address: string | null;
  contractor_suburb: string | null;
  contractor_state: string | null;
  contractor_postcode: string | null;
}

export interface ReviewReceipt {
  id: string;
  original_filename: string | null;
  status: "pending" | "extracting" | "needs_review" | "failed";
  extracted: ExtractedFields | null;
  confidence: number | null;
  error: string | null;
  renovation_id: string | null;
  property_id: string | null;
  property_address: string | null;
}

interface Row extends ExtractedFields {
  id: string;
  filename: string;
  amountStr: string;
  category: Category;
  context_notes: string;
  propertyId: string;
  propertyAddress: string;
  renovationId: string;
  renovationText: string;
  status: RenoStatus;
  rowStatus: "idle" | "committing" | "error";
}

function normaliseCategory(value: string | null): Category {
  return (CATEGORIES as readonly string[]).includes(value ?? "") ? (value as Category) : "labour";
}

function normaliseRenoStatus(value: string | null | undefined): RenoStatus {
  return RENO_STATUSES.some((s) => s.value === value) ? (value as RenoStatus) : "completed";
}

// Identifies the renovation a row will land on, so rows sharing one renovation
// (an existing one, or the same typed new name within a property) can be kept
// in sync. Returns null when no renovation is set yet.
function renovationKey(row: Row): string | null {
  if (row.renovationId) return `id:${row.renovationId}`;
  const name = row.renovationText.trim().toLowerCase();
  return name ? `new:${row.propertyId}::${name}` : null;
}

function rowFromReceipt(r: ReviewReceipt, renovations: RenovationOption[]): Row {
  const e = r.extracted ?? ({} as ExtractedFields);
  const matched = renovations.find((opt) => opt.id === r.renovation_id);
  return {
    id: r.id,
    filename: r.original_filename ?? "receipt",
    amount: e.amount ?? null,
    amountStr: e.amount != null ? String(e.amount) : "",
    gst_amount: e.gst_amount ?? null,
    expense_date: e.expense_date ?? null,
    description: e.description ?? null,
    supplier: e.supplier ?? null,
    abn: e.abn ?? null,
    category: normaliseCategory(e.category ?? null),
    trade: e.trade ?? null,
    raw_text: e.raw_text ?? null,
    contractor_phone: e.contractor_phone ?? null,
    contractor_email: e.contractor_email ?? null,
    contractor_website: e.contractor_website ?? null,
    contractor_address: e.contractor_address ?? null,
    contractor_suburb: e.contractor_suburb ?? null,
    contractor_state: e.contractor_state ?? null,
    contractor_postcode: e.contractor_postcode ?? null,
    context_notes: "",
    propertyId: r.property_id ?? "",
    propertyAddress: r.property_address ?? "Unassigned property",
    renovationId: r.renovation_id ?? "",
    renovationText: matched?.name ?? "",
    status: matched ? normaliseRenoStatus(matched.status) : "completed",
    rowStatus: "idle",
  };
}

export function ReviewQueue({
  initialReceipts,
  renovations,
  properties,
}: {
  initialReceipts: ReviewReceipt[];
  renovations: RenovationOption[];
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const drivingRef = useRef(false);
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    initialReceipts.filter((r) => r.status === "needs_review").map((r) => rowFromReceipt(r, renovations)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDismiss, setPendingDismiss] = useState<{ id: string; name: string } | null>(null);

  const processing = initialReceipts.filter(
    (r) => r.status === "pending" || r.status === "extracting",
  ).length;

  const [moving, setMoving] = useState(false);

  const failed = initialReceipts.filter((r) => r.status === "failed");

  // The property these receipts currently belong to — used as the dropdown's
  // value. "" when the queue spans multiple properties (or none).
  const distinctProperties = new Set(rows.map((r) => r.propertyId));
  const currentPropertyId = distinctProperties.size === 1 ? [...distinctProperties][0] : "";

  // Renovations grouped by property, plus a name→id resolver per property.
  const renosByProperty = useMemo(() => {
    const m = new Map<string, RenovationOption[]>();
    for (const r of renovations) {
      const list = m.get(r.propertyId) ?? [];
      list.push(r);
      m.set(r.propertyId, list);
    }
    return m;
  }, [renovations]);

  const renovationStatusById = useMemo(() => {
    const m = new Map<string, RenoStatus>();
    for (const r of renovations) m.set(r.id, normaliseRenoStatus(r.status));
    return m;
  }, [renovations]);

  function resolveRenovationId(propertyId: string, text: string): string {
    const t = text.trim().toLowerCase();
    if (!t) return "";
    return (renosByProperty.get(propertyId) ?? []).find((r) => r.name.toLowerCase() === t)?.id ?? "";
  }

  // Reconcile local editable rows with refreshed server data without clobbering edits.
  useEffect(() => {
    const ready = initialReceipts.filter((r) => r.status === "needs_review");
    const readyIds = new Set(ready.map((r) => r.id));
    setRows((prev) => {
      const existing = new Map(prev.map((row) => [row.id, row]));
      const kept = prev.filter((row) => readyIds.has(row.id));
      const added = ready
        .filter((r) => !existing.has(r.id))
        .map((r) => rowFromReceipt(r, renovations));
      return [...kept, ...added];
    });
    setSelected((prev) => new Set([...prev].filter((id) => readyIds.has(id))));
  }, [initialReceipts, renovations]);

  // Drive the extraction worker until the queue drains.
  useEffect(() => {
    if (processing === 0 || drivingRef.current) return;
    drivingRef.current = true;
    setExtracting(true);
    (async () => {
      try {
        for (;;) {
          const res = await fetch("/api/import/extract", { method: "POST" });
          if (!res.ok) break;
          const data = (await res.json()) as { processed: number; failed: number; remaining: number };
          router.refresh();
          if (data.remaining === 0 || data.processed + data.failed === 0) break;
        }
      } finally {
        drivingRef.current = false;
        setExtracting(false);
      }
    })();
  }, [processing, router]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setRenovationText(id: string, propertyId: string, text: string) {
    setRows((prev) => {
      const existingId = resolveRenovationId(propertyId, text);
      const name = text.trim().toLowerCase();
      let status: RenoStatus;
      if (existingId) {
        // Existing renovation → reflect its current status.
        status = renovationStatusById.get(existingId) ?? "completed";
      } else if (name) {
        // New name → adopt a same-named sibling's status if one exists, so
        // duplicates stay in sync; otherwise keep this row's status.
        const sibling = prev.find(
          (r) =>
            r.id !== id &&
            !r.renovationId &&
            r.propertyId === propertyId &&
            r.renovationText.trim().toLowerCase() === name,
        );
        status = sibling?.status ?? prev.find((r) => r.id === id)?.status ?? "completed";
      } else {
        status = prev.find((r) => r.id === id)?.status ?? "completed";
      }
      return prev.map((r) =>
        r.id === id ? { ...r, renovationText: text, renovationId: existingId, status } : r,
      );
    });
  }

  // Change a row's status and keep every row sharing its renovation in sync.
  function setRowStatus(id: string, status: RenoStatus) {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      const key = target ? renovationKey(target) : null;
      return prev.map((r) =>
        r.id === id || (key && renovationKey(r) === key) ? { ...r, status } : r,
      );
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyRenovationToProperty(propertyId: string, text: string) {
    const renovationId = resolveRenovationId(propertyId, text);
    // Rows now share one renovation, so unify status: an existing renovation's
    // current status, or "completed" for a new one.
    const status: RenoStatus = renovationId
      ? renovationStatusById.get(renovationId) ?? "completed"
      : "completed";
    setRows((prev) =>
      prev.map((r) =>
        r.propertyId === propertyId ? { ...r, renovationText: text, renovationId, status } : r,
      ),
    );
  }

  async function moveToProperty(propertyId: string) {
    if (!propertyId || rows.length === 0) return;
    const address = properties.find((p) => p.id === propertyId)?.address ?? "property";
    const ids = rows.map((r) => r.id);
    setMoving(true);
    try {
      await setStagedReceiptsProperty(ids, propertyId);
      // Property changed → renovation no longer applies; clear it.
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          propertyId,
          propertyAddress: address,
          renovationId: "",
          renovationText: "",
        })),
      );
      toast.success(`Moved ${ids.length} receipt${ids.length !== 1 ? "s" : ""} to ${address}`);
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't move receipts: ${(err as Error).message}`);
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  function selectProperty(propertyId: string, on: boolean) {
    const ids = rows.filter((r) => r.propertyId === propertyId).map((r) => r.id);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function enrich(expenseId: string, row: Row) {
    fetch(`/api/extract/${expenseId}`, { method: "POST" }).catch(() => {});
    if (row.supplier?.trim()) {
      fetch("/api/contractors/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId,
          name: row.supplier,
          abn: row.abn,
          phone: row.contractor_phone,
          email: row.contractor_email,
          website: row.contractor_website,
          address: row.contractor_address,
          suburb: row.contractor_suburb,
          state: row.contractor_state,
          postcode: row.contractor_postcode,
        }),
      }).catch(() => {});
    }
    fetch(`/api/classify/${expenseId}`, { method: "POST" }).catch(() => {});
  }

  async function commitSelected() {
    const chosen = rows.filter((r) => selected.has(r.id));
    const targets = chosen.filter((r) => r.renovationId || r.renovationText.trim());
    const missing = chosen.length - targets.length;
    if (targets.length === 0) {
      toast.error(
        missing > 0 ? "Choose or type a renovation for each selected receipt" : "Select receipts to commit",
      );
      return;
    }
    if (missing > 0) {
      toast.message(`${missing} selected receipt${missing !== 1 ? "s" : ""} skipped — no renovation set`);
    }

    // Pre-create distinct new renovations (typed names with no existing match),
    // so concurrent commits reuse one id instead of racing to duplicate it.
    // New renovations are created with the row's chosen status.
    const toCreate = new Map<string, { name: string; propertyId: string; status: RenoStatus }>();
    for (const row of targets) {
      if (!row.renovationId) {
        const name = row.renovationText.trim();
        if (name && row.propertyId) {
          toCreate.set(`${row.propertyId}::${name.toLowerCase()}`, {
            name,
            propertyId: row.propertyId,
            status: row.status,
          });
        }
      }
    }
    const createdIds = new Map<string, string>();
    for (const [key, { name, propertyId, status }] of toCreate) {
      try {
        const created = await createRenovation(name, propertyId, status);
        createdIds.set(key, created.id);
      } catch (err) {
        toast.error(`Couldn't create renovation "${name}": ${(err as Error).message}`);
      }
    }

    targets.forEach((r) => updateRow(r.id, { rowStatus: "committing" }));

    let committed = 0;
    let cursor = 0;
    async function worker() {
      while (cursor < targets.length) {
        const row = targets[cursor++];
        try {
          let renovationId = row.renovationId;
          if (!renovationId) {
            const key = `${row.propertyId}::${row.renovationText.trim().toLowerCase()}`;
            renovationId = createdIds.get(key) ?? "";
          }
          if (!renovationId) throw new Error("No renovation");

          const { expenseId } = await commitStagedReceipt(
            row.id,
            {
              amount: row.amountStr.trim() === "" ? null : Number(row.amountStr),
              gst_amount: row.gst_amount,
              expense_date: row.expense_date,
              description: row.description,
              supplier: row.supplier,
              abn: row.abn,
              category: row.category,
              context_notes: row.context_notes.trim() || null,
              raw_text: row.raw_text,
            },
            { renovationId },
          );
          await enrich(expenseId, row);
          committed++;
          setRows((prev) => prev.filter((x) => x.id !== row.id));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        } catch (err) {
          updateRow(row.id, { rowStatus: "error" });
          toast.error(`Failed to commit ${row.filename}: ${(err as Error).message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(COMMIT_CONCURRENCY, targets.length) }, worker));

    if (committed > 0) {
      toast.success(`${committed} expense${committed !== 1 ? "s" : ""} added`);
      router.refresh();
    }
  }

  async function dismiss(id: string) {
    try {
      await dismissStagedReceipt(id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function confirmDismiss() {
    if (!pendingDismiss) return;
    const { id } = pendingDismiss;
    setPendingDismiss(null);
    await dismiss(id);
  }

  // Group rows by property — renovations (and create-new) are scoped per property.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const list = groups.get(row.propertyId) ?? [];
    list.push(row);
    groups.set(row.propertyId, list);
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Property</span>
          <div className="w-80">
            <Select
              value={currentPropertyId}
              onValueChange={(v) => moveToProperty(v ?? "")}
              disabled={moving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Multiple properties — choose to move all…">
                  {(value) => properties.find((p) => p.id === value)?.address}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {moving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {(processing > 0 || extracting) && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Extracting {processing} receipt{processing !== 1 ? "s" : ""}… fields will appear as they finish.
        </div>
      )}

      {failed.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/40 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-red-700">
            {failed.length} receipt{failed.length !== 1 ? "s" : ""} couldn&apos;t be read
          </p>
          {failed.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="truncate flex-1">{f.original_filename ?? "receipt"}</span>
              <span className="text-xs text-muted-foreground truncate max-w-xs">{f.error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDismiss({ id: f.id, name: f.original_filename ?? "receipt" })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && processing === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-16 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nothing to review. Imported receipts will appear here.</p>
        </div>
      ) : null}

      {[...groups.entries()].map(([propertyId, groupRows]) => {
        const groupSelected = groupRows.every((r) => selected.has(r.id));
        const listId = `reno-${propertyId || "none"}`;
        return (
          <div key={propertyId} className="rounded-lg border overflow-hidden">
            <datalist id={listId}>
              {(renosByProperty.get(propertyId) ?? []).map((r) => (
                <option key={r.id} value={r.name} />
              ))}
            </datalist>

            <div className="flex flex-wrap items-center gap-3 bg-muted/40 px-3 py-2">
              <input
                type="checkbox"
                aria-label={`Select all for ${groupRows[0]?.propertyAddress}`}
                checked={groupSelected}
                onChange={(e) => selectProperty(propertyId, e.target.checked)}
              />
              <span className="text-sm font-medium">{groupRows[0]?.propertyAddress}</span>
              <span className="text-xs text-muted-foreground">
                {groupRows.length} receipt{groupRows.length !== 1 ? "s" : ""}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Renovation for all:</span>
                <div className="w-64">
                  <input
                    list={listId}
                    placeholder="Select or type new…"
                    onChange={(e) => applyRenovationToProperty(propertyId, e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            </div>

            <div className="hidden items-center gap-2 border-b bg-background px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:flex">
              <span className="h-4 w-4 shrink-0" aria-hidden />
              <span className="h-4 w-4 shrink-0" aria-hidden />
              <span className="w-36">Receipt</span>
              <span className="w-40">Supplier</span>
              <span className="w-28">Amount</span>
              <span className="w-36">Date</span>
              <span className="w-52">Renovation</span>
              <span className="w-36">Status</span>
            </div>

            <div className="divide-y">
              {groupRows.map((row) => (
                <div
                  key={row.id}
                  className={`flex flex-wrap items-center gap-2 px-3 py-2 ${
                    row.rowStatus === "committing" ? "opacity-60" : ""
                  } ${row.rowStatus === "error" ? "bg-red-50/40" : ""}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.filename}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="w-36 truncate text-xs text-muted-foreground" title={row.filename}>
                    {row.filename}
                  </span>
                  <Input
                    value={row.supplier ?? ""}
                    onChange={(e) => updateRow(row.id, { supplier: e.target.value })}
                    placeholder="Supplier"
                    className="h-8 w-40 text-sm"
                  />
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      value={row.amountStr}
                      onChange={(e) => updateRow(row.id, { amountStr: e.target.value })}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-8 w-28 pl-5 text-sm"
                    />
                  </div>
                  <Input
                    type="date"
                    value={row.expense_date ?? ""}
                    onChange={(e) => updateRow(row.id, { expense_date: e.target.value || null })}
                    className="h-8 w-36 text-sm"
                  />
                  <input
                    list={listId}
                    value={row.renovationText}
                    onChange={(e) => setRenovationText(row.id, row.propertyId, e.target.value)}
                    placeholder="Select or type renovation…"
                    className="h-8 w-52 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <div className="w-36">
                    <Select
                      value={row.status}
                      onValueChange={(v) => setRowStatus(row.id, (v ?? "completed") as RenoStatus)}
                      disabled={Boolean(row.renovationId)}
                    >
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue>
                          {(value) => RENO_STATUSES.find((s) => s.value === value)?.label}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {RENO_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {row.rowStatus === "committing" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setPendingDismiss({ id: row.id, name: row.filename })}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {rows.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
              }
            />
            Select all
          </label>
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button className="ml-auto" onClick={commitSelected} disabled={selected.size === 0}>
            Commit selected
          </Button>
        </div>
      )}

      <Dialog open={pendingDismiss !== null} onOpenChange={(open) => !open && setPendingDismiss(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove receipt?</DialogTitle>
            <DialogDescription>
              {pendingDismiss
                ? `"${pendingDismiss.name}" will be removed from the import queue and won't be committed. You can re-upload it later if needed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDismiss(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDismiss}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
