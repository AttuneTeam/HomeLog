"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  RentalOperatingExpense,
  RentalExpenseCategory,
} from "@/lib/supabase/database.types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  FileText,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";

const CATEGORIES: { value: RentalExpenseCategory; label: string }[] = [
  { value: "water", label: "Water" },
  { value: "council_rates", label: "Council Rates" },
  { value: "insurance", label: "Insurance" },
  { value: "repairs_maintenance", label: "Repairs & Maintenance" },
  { value: "strata_fees", label: "Strata Fees" },
  { value: "land_tax", label: "Land Tax" },
  { value: "other", label: "Other" },
];

function categoryLabel(cat: RentalExpenseCategory): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const schema = z.object({
  category: z.enum([
    "water",
    "council_rates",
    "insurance",
    "repairs_maintenance",
    "strata_fees",
    "land_tax",
    "other",
  ]),
  amount: z.string().min(1, "Amount is required"),
  gst_amount: z.string().optional(),
  expense_date: z.string().min(1, "Date is required"),
  supplier: z.string().optional(),
  abn: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | {
      mode: "edit";
      expense: RentalOperatingExpense;
      invoiceUrl: string | null;
    };

interface RentalExpensesSectionProps {
  propertyId: string;
  userId: string;
  initialExpenses: RentalOperatingExpense[];
}

export function RentalExpensesSection({
  propertyId,
  userId,
  initialExpenses,
}: RentalExpensesSectionProps) {
  const [expenses, setExpenses] =
    useState<RentalOperatingExpense[]>(initialExpenses);
  const [dialogState, setDialogState] = useState<DialogState>({
    mode: "closed",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [aiPrefilled, setAiPrefilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedCategory = watch("category");

  const sorted = [...expenses].sort(
    (a, b) =>
      new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
  );

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  function openAdd() {
    reset({
      category: "other",
      amount: "",
      gst_amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      supplier: "",
      abn: "",
      description: "",
      notes: "",
    });
    setFile(null);
    setAiPrefilled(false);
    setDialogState({ mode: "add" });
  }

  async function openEdit(expense: RentalOperatingExpense) {
    let invoiceUrl: string | null = null;
    if (expense.invoice_path) {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("invoices")
        .createSignedUrl(expense.invoice_path, 3600);
      invoiceUrl = data?.signedUrl ?? null;
    }
    reset({
      category: expense.category,
      amount: String(expense.amount),
      gst_amount: expense.gst_amount != null ? String(expense.gst_amount) : "",
      expense_date: expense.expense_date,
      supplier: expense.supplier ?? "",
      abn: expense.abn ?? "",
      description: expense.description ?? "",
      notes: expense.notes ?? "",
    });
    setFile(null);
    setAiPrefilled(false);
    setDialogState({ mode: "edit", expense, invoiceUrl });
  }

  function closeDialog() {
    setDialogState({ mode: "closed" });
    setFile(null);
    setAiPrefilled(false);
  }

  async function uploadFile(f: File): Promise<string | null> {
    const supabase = createClient();
    const ext = f.name.split(".").pop();
    const path = `${userId}/rental-expenses/${propertyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("invoices").upload(path, f);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    return path;
  }

  async function extractFromFile(selected: File) {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch("/api/extract/invoice", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.amount != null) setValue("amount", String(data.amount));
      if (data.gst_amount != null)
        setValue("gst_amount", String(data.gst_amount));
      if (data.expense_date) setValue("expense_date", data.expense_date);
      if (data.description) setValue("description", data.description);
      if (data.supplier) setValue("supplier", data.supplier);
      if (data.abn) setValue("abn", data.abn);
      setAiPrefilled(true);
    } catch {
      // silent — user fills manually
    } finally {
      setExtracting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setAiPrefilled(false);
    extractFromFile(selected);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const supabase = createClient();

    let invoicePath =
      dialogState.mode === "edit" ? dialogState.expense.invoice_path : null;
    if (file) {
      const uploaded = await uploadFile(file);
      if (!uploaded) {
        setSaving(false);
        return;
      }
      invoicePath = uploaded;
    }

    const payload = {
      property_id: propertyId,
      category: values.category,
      amount: parseFloat(values.amount),
      gst_amount: values.gst_amount ? parseFloat(values.gst_amount) : null,
      expense_date: values.expense_date,
      supplier: values.supplier?.trim() || null,
      abn: values.abn?.trim() || null,
      description: values.description?.trim() || null,
      notes: values.notes?.trim() || null,
      invoice_path: invoicePath,
    };

    if (dialogState.mode === "edit") {
      const { data, error } = await supabase
        .from("rental_operating_expenses")
        .update(payload)
        .eq("id", dialogState.expense.id)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === dialogState.expense.id
            ? (data as RentalOperatingExpense)
            : e,
        ),
      );
      toast.success("Expense updated");
    } else {
      const { data, error } = await supabase
        .from("rental_operating_expenses")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setExpenses((prev) => [...prev, data as RentalOperatingExpense]);
      toast.success("Expense added");
    }

    setSaving(false);
    closeDialog();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("rental_operating_expenses")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setDeletingId(null);
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Expense removed");
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  return (
    <div className="mb-8 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Rental Operating Expenses</h2>
        <Button size="sm" onClick={openAdd} variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add expense
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <Receipt className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No rental expenses yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Track water bills, council rates, insurance and other property
              operating costs
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-1 pb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expense
            </span>
          </div>
          <div className="divide-y">
            {sorted.map((expense) => (
              <div
                key={expense.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 items-center px-1 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">
                    {expense.supplier
                      ? expense.supplier
                      : categoryLabel(expense.category)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {categoryLabel(expense.category)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(expense.expense_date)}
                </span>
                <span className="text-sm tabular-nums text-right whitespace-nowrap">
                  {formatCurrency(expense.amount)}
                </span>
                <div className="flex gap-1 justify-end">
                  {expense.invoice_path && (
                    <InvoiceLink invoicePath={expense.invoice_path} />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(expense)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    disabled={deletingId === expense.id}
                    onClick={() => setConfirmDeleteId(expense.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-1 pt-2 mt-1 border-t text-sm">
            <span className="text-muted-foreground">
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "edit"
                ? "Edit rental expense"
                : "Add rental expense"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              {/* Invoice upload */}
              <div className="space-y-2">
                <Label>Bill / invoice</Label>
                {file ? (
                  <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                    {extracting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    {extracting && (
                      <span className="text-xs text-muted-foreground">
                        Scanning…
                      </span>
                    )}
                    {aiPrefilled && !extracting && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Sparkles className="h-3 w-3" /> Fields filled
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setAiPrefilled(false);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : dialogState.mode === "edit" &&
                  dialogState.expense.invoice_path ? (
                  <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-muted-foreground">
                      Existing bill attached
                    </span>
                    {dialogState.invoiceUrl && (
                      <a
                        href={dialogState.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-2 text-blue-600 hover:text-blue-800"
                      >
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload bill to auto-fill fields
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select
                  value={watchedCategory ?? "other"}
                  onValueChange={(v) =>
                    setValue("category", v as RentalExpenseCategory, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-destructive">
                    {errors.category.message}
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="expense_date">Date *</Label>
                <Input
                  id="expense_date"
                  type="date"
                  {...register("expense_date")}
                />
                {errors.expense_date && (
                  <p className="text-xs text-destructive">
                    {errors.expense_date.message}
                  </p>
                )}
              </div>

              {/* Amount + GST */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Total amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("amount")}
                  />
                  {errors.amount && (
                    <p className="text-xs text-destructive">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gst_amount">GST included ($)</Label>
                  <Input
                    id="gst_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("gst_amount")}
                  />
                </div>
              </div>

              {/* Supplier + ABN */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    placeholder="e.g. Sydney Water"
                    {...register("supplier")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    placeholder="12 345 678 901"
                    {...register("abn")}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g. Q1 water usage"
                  {...register("description")}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Any additional context…"
                  {...register("notes")}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || extracting}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : null}
                {dialogState.mode === "edit" ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove expense?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this rental expense. This action cannot
            be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingId !== null}
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              {deletingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceLink({ invoicePath }: { invoicePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    if (url) {
      window.open(url, "_blank");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoicePath, 3600);
    setLoading(false);
    if (data?.signedUrl) {
      setUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={open}
      disabled={loading}
      title="View bill"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
    </Button>
  );
}
