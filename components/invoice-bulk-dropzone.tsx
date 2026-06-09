"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createExpenseFromInvoice } from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type AiClassification =
  | "Immediate Deduction"
  | "Capital Works (Div 43)"
  | "Plant & Equipment (Div 40)";

interface ParsedInvoice {
  file: File;
  amount: number | null;
  gst_amount: number | null;
  expense_date: string | null;
  description: string | null;
  supplier: string | null;
  abn: string | null;
  contractor_phone: string | null;
  contractor_email: string | null;
  contractor_website: string | null;
  contractor_address: string | null;
  contractor_suburb: string | null;
  contractor_state: string | null;
  contractor_postcode: string | null;
  raw_text: string | null;
  context_notes: string;
  parseError?: string;
}

interface InvoiceResult {
  phase: "pending" | "saving" | "classifying" | "done" | "error";
  classification?: AiClassification;
  errorMessage?: string;
}

type DialogPhase = "confirm" | "processing" | "complete";

interface Props {
  renovationId: string;
  propertyId: string;
  userId: string;
}

function ClassificationBadge({ classification }: { classification: AiClassification }) {
  const styles: Record<AiClassification, string> = {
    "Immediate Deduction": "bg-purple-100 text-purple-800",
    "Capital Works (Div 43)": "bg-amber-100 text-amber-800",
    "Plant & Equipment (Div 40)": "bg-sky-100 text-sky-800",
  };
  const labels: Record<AiClassification, string> = {
    "Immediate Deduction": "Immediate Deduction",
    "Capital Works (Div 43)": "Capital Works",
    "Plant & Equipment (Div 40)": "Plant & Equipment",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[classification]}`}
    >
      {labels[classification]}
    </span>
  );
}

function formatExpenseDate(dateStr: string | null): string {
  if (!dateStr) return "Today";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function InvoiceBulkDropzone({ renovationId, propertyId: _propertyId, userId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [invoices, setInvoices] = useState<ParsedInvoice[]>([]);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>("confirm");
  const [dialogOpen, setDialogOpen] = useState(false);

  const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.webp";

  const classifiedCount = results.filter((r) => r.phase === "done" || r.phase === "error").length;

  async function parseFiles(files: File[]) {
    setParsing(true);
    const parsed = await Promise.all(
      files.map(async (file): Promise<ParsedInvoice> => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/extract/invoice", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Parse failed");
          const data = await res.json();
          return { ...data, file, context_notes: "" };
        } catch {
          return {
            file,
            amount: null,
            gst_amount: null,
            expense_date: null,
            description: null,
            supplier: null,
            abn: null,
            contractor_phone: null,
            contractor_email: null,
            contractor_website: null,
            contractor_address: null,
            contractor_suburb: null,
            contractor_state: null,
            contractor_postcode: null,
            raw_text: null,
            context_notes: "",
            parseError: "Could not parse — you can still save with missing fields",
          };
        }
      }),
    );
    setParsing(false);
    setInvoices(parsed);
    setResults(parsed.map(() => ({ phase: "pending" })));
    setDialogPhase("confirm");
    setDialogOpen(true);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|jpg|jpeg|png|heic|webp)$/i.test(f.name),
    );
    if (files.length) parseFiles(files);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) parseFiles(files);
    e.target.value = "";
  }

  function updateNotes(index: number, value: string) {
    setInvoices((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, context_notes: value } : inv)),
    );
  }

  function removeInvoice(index: number) {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
    setResults((prev) => prev.filter((_, i) => i !== index));
  }

  function setResult(index: number, update: Partial<InvoiceResult>) {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...update } : r)));
  }

  async function uploadFile(file: File): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/${renovationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("invoices").upload(path, file);
    if (error) return null;
    return path;
  }

  async function handleConfirm() {
    if (!invoices.length) return;
    setDialogPhase("processing");

    let saved = 0;
    await Promise.all(
      invoices.map(async (inv, i) => {
        try {
          setResult(i, { phase: "saving" });
          const today = new Date().toISOString().split("T")[0];
          const { id } = await createExpenseFromInvoice({
            renovationId,
            amount: inv.amount ?? 0,
            gst_amount: inv.gst_amount,
            expense_date: inv.expense_date ?? today,
            description: inv.description,
            supplier: inv.supplier,
            abn: inv.abn,
            context_notes: inv.context_notes || null,
            raw_text: inv.raw_text,
          });

          const supabase = createClient();
          const path = await uploadFile(inv.file);
          if (path) {
            await supabase.from("expenses").update({ invoice_path: path }).eq("id", id);
            fetch(`/api/extract/${id}`, { method: "POST" }).catch(() => {});
          }

          if (inv.supplier?.trim()) {
            fetch("/api/contractors/upsert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expenseId: id,
                name: inv.supplier,
                abn: inv.abn ?? null,
                phone: inv.contractor_phone ?? null,
                email: inv.contractor_email ?? null,
                website: inv.contractor_website ?? null,
                address: inv.contractor_address ?? null,
                suburb: inv.contractor_suburb ?? null,
                state: inv.contractor_state ?? null,
                postcode: inv.contractor_postcode ?? null,
              }),
            }).catch(() => {});
          }

          setResult(i, { phase: "classifying" });
          const classifyRes = await fetch(`/api/classify/${id}`, { method: "POST" });
          if (classifyRes.ok) {
            const data = await classifyRes.json();
            setResult(i, {
              phase: "done",
              classification: data.classification?.classification as AiClassification | undefined,
            });
          } else {
            setResult(i, { phase: "error", errorMessage: "Classification failed" });
          }

          saved++;
        } catch (err) {
          console.error(err);
          setResult(i, { phase: "error", errorMessage: "Failed to save" });
          toast.error(`Failed to save ${inv.file.name}`);
        }
      }),
    );

    setDialogPhase("complete");
    if (saved > 0) {
      router.refresh();
    }
  }

  function handleClose() {
    setDialogOpen(false);
    setInvoices([]);
    setResults([]);
    setDialogPhase("confirm");
  }

  const isProcessing = dialogPhase === "processing";
  const isComplete = dialogPhase === "complete";

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={onInputChange}
        />
        {parsing ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Parsing invoices…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <p className="text-sm font-medium">Drop invoices here to bulk import</p>
            <p className="text-xs">PDF, JPG, PNG, HEIC, WebP</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !isProcessing) handleClose(); }}>
        <DialogContent className="w-[90vw] max-w-4xl sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>
                {dialogPhase === "confirm" && `Confirm invoices (${invoices.length})`}
                {dialogPhase === "processing" && (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Classifying… {classifiedCount} of {invoices.length} complete
                  </span>
                )}
                {dialogPhase === "complete" && `Done — ${invoices.length} expense${invoices.length !== 1 ? "s" : ""} added`}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {invoices.map((inv, i) => {
              const result = results[i];
              const isDone = result?.phase === "done";
              const isError = result?.phase === "error";
              const isClassifying = result?.phase === "classifying" || result?.phase === "saving";

              return (
                <div
                  key={i}
                  className={`rounded-lg border p-4 space-y-3 relative transition-colors ${
                    isDone ? "border-green-200 bg-green-50/30" : isError ? "border-red-200 bg-red-50/30" : ""
                  }`}
                >
                  {/* Remove button — only in confirm phase */}
                  {dialogPhase === "confirm" && (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeInvoice(i)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Status icon — during/after processing */}
                  {isProcessing || isComplete ? (
                    <div className="absolute top-3 right-3">
                      {isDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {isError && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {isClassifying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-sm font-medium pr-6">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{inv.file.name}</span>
                    {isDone && result.classification && (
                      <ClassificationBadge classification={result.classification} />
                    )}
                    {isError && (
                      <span className="text-xs text-red-500">{result.errorMessage}</span>
                    )}
                  </div>

                  {inv.parseError && (
                    <p className="text-xs text-amber-600">{inv.parseError}</p>
                  )}

                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Description</span>
                    <p className="font-medium">{inv.description ?? "—"}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Supplier</span>
                      <p className="font-medium truncate">{inv.supplier ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Amount</span>
                      <p className="font-medium">
                        {inv.amount != null ? formatCurrency(inv.amount) : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Date</span>
                      <p className="font-medium">{formatExpenseDate(inv.expense_date)}</p>
                    </div>
                  </div>

                  {/* Context notes — only editable in confirm phase */}
                  {dialogPhase === "confirm" ? (
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Context notes (optional — helps AI tax classification)
                      </label>
                      <Textarea
                        value={inv.context_notes}
                        onChange={(e) => updateNotes(i, e.target.value)}
                        placeholder="e.g. Repair to existing gutters, not a capital improvement"
                        className="mt-1 text-sm resize-none"
                        rows={2}
                      />
                    </div>
                  ) : inv.context_notes ? (
                    <div>
                      <span className="text-muted-foreground text-xs">Context notes</span>
                      <p className="text-sm text-muted-foreground">{inv.context_notes}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-4">
            {dialogPhase === "confirm" && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={invoices.length === 0}>
                  Save {invoices.length} expense{invoices.length !== 1 ? "s" : ""}
                </Button>
              </>
            )}
            {dialogPhase === "processing" && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing…
              </Button>
            )}
            {dialogPhase === "complete" && (
              <Button onClick={handleClose}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
