"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Upload, X, FileText, Loader2, Sparkles } from "lucide-react";

const schema = z.object({
  amount: z.string().min(1, "Amount is required"),
  gst_amount: z.string().optional(),
  expense_date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  supplier: z.string().optional(),
  abn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  context_notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExpenseFormProps {
  renovationId: string;
  propertyId: string;
  userId: string;
  defaultValues?: Omit<Partial<FormValues>, "gst_amount"> & {
    id?: string;
    invoice_path?: string | null;
    abn?: string | null;
    gst_amount?: number | null;
    context_notes?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
  };
}

export function ExpenseForm({
  renovationId,
  propertyId,
  userId,
  defaultValues,
}: ExpenseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [existingInvoicePath, setExistingInvoicePath] = useState<string | null>(
    defaultValues?.invoice_path ?? null,
  );
  const [aiPrefilled, setAiPrefilled] = useState(false);
  const [extractedRawText, setExtractedRawText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: defaultValues?.amount ?? "",
      gst_amount:
        defaultValues?.gst_amount != null
          ? String(defaultValues.gst_amount)
          : "",
      expense_date:
        defaultValues?.expense_date ?? new Date().toISOString().split("T")[0],
      description: defaultValues?.description ?? "",
      supplier: defaultValues?.supplier ?? "",
      abn: defaultValues?.abn ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      website: defaultValues?.website ?? "",
      address: defaultValues?.address ?? "",
      suburb: defaultValues?.suburb ?? "",
      state: defaultValues?.state ?? "",
      postcode: defaultValues?.postcode ?? "",
      context_notes: defaultValues?.context_notes ?? "",
    },
  });

  async function uploadFile(
    userId: string,
    renovationId: string,
    file: File,
  ): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/${renovationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("invoices")
      .upload(path, file);
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
      if (data.contractor_phone) setValue("phone", data.contractor_phone);
      if (data.contractor_email) setValue("email", data.contractor_email);
      if (data.contractor_website) setValue("website", data.contractor_website);
      if (data.contractor_address) setValue("address", data.contractor_address);
      if (data.contractor_suburb) setValue("suburb", data.contractor_suburb);
      if (data.contractor_state) setValue("state", data.contractor_state);
      if (data.contractor_postcode) setValue("postcode", data.contractor_postcode);
      if (data.raw_text) setExtractedRawText(data.raw_text);
      setAiPrefilled(true);
    } catch {
      // silent — user can fill in manually
    } finally {
      setExtracting(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const supabase = createClient();

    let invoicePath = existingInvoicePath;
    if (file) {
      const uploaded = await uploadFile(userId, renovationId, file);
      if (!uploaded) {
        setLoading(false);
        return;
      }
      invoicePath = uploaded;
    }

    const payload = {
      amount: parseFloat(values.amount),
      gst_amount: values.gst_amount ? parseFloat(values.gst_amount) : null,
      expense_date: values.expense_date,
      description: values.description || null,
      supplier: values.supplier || null,
      abn: values.abn || null,
      invoice_path: invoicePath,
      context_notes: values.context_notes || null,
      ...(extractedRawText ? { raw_text: extractedRawText } : {}),
    };

    if (isEdit) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", defaultValues!.id!);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Expense updated");
      // Upsert contractor from existing form fields (name + ABN at minimum)
      const supplierName = values.supplier?.trim();
      if (supplierName) {
        fetch("/api/contractors/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expenseId: defaultValues!.id!,
            name: supplierName,
            abn: values.abn || null,
            phone: values.phone || null,
            email: values.email || null,
            website: values.website || null,
            address: values.address || null,
            suburb: values.suburb || null,
            state: values.state || null,
            postcode: values.postcode || null,
          }),
        }).catch(() => {});
      }
      router.push(
        `/properties/${propertyId}/renovations/${renovationId}/expenses/${defaultValues!.id!}`,
      );
    } else {
      const { data: newExpense, error } = await supabase
        .from("expenses")
        .insert({ ...payload, renovation_id: renovationId, category: "other" })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Expense added");
      if (invoicePath) {
        fetch(`/api/extract/${newExpense.id}`, { method: "POST" }).catch(() => {});
      }
      // Auto-build contractor record from extracted invoice data
      const supplierName = values.supplier?.trim();
      if (supplierName) {
        fetch("/api/contractors/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expenseId: newExpense.id,
            name: supplierName,
            abn: values.abn || null,
            phone: values.phone || null,
            email: values.email || null,
            website: values.website || null,
            address: values.address || null,
            suburb: values.suburb || null,
            state: values.state || null,
            postcode: values.postcode || null,
          }),
        }).catch(() => {});
      }
      // Auto-generate value-add summary
      fetch(`/api/value-summary/${newExpense.id}`, { method: "POST" }).catch(() => {});
      router.push(
        `/properties/${propertyId}/renovations/${renovationId}/expenses/${newExpense.id}`,
      );
    }
    router.refresh();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setAiPrefilled(false);
    if (!isEdit) extractFromFile(selected);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Invoice upload — top of form for new expenses */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Invoice / receipt</Label>
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
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Upload invoice to auto-fill fields
                </button>
              )}
              {file && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Replace file
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Total amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
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
                {...register("gst_amount")}
              />
            </div>
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Supplier / contractor</Label>
              <Input
                id="supplier"
                {...register("supplier")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abn">Supplier ABN</Label>
              <Input
                id="abn"
                {...register("abn")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              {...register("website")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              {...register("address")}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="suburb">Suburb</Label>
              <Input
                id="suburb"
                {...register("suburb")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                {...register("state")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                {...register("postcode")}
              />
            </div>
          </div>

          {/* Invoice upload for edit mode */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Invoice / receipt</Label>
              {existingInvoicePath && !file && (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-muted-foreground">
                    {existingInvoicePath.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExistingInvoicePath(null)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {file && (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {!file && !existingInvoicePath && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Click to upload invoice, receipt, or any document
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {(file || existingInvoicePath) && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Replace file
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="context_notes">
              Additional context for AI classification
            </Label>
            <p className="text-xs text-muted-foreground">
              Anything not captured in the invoice — e.g. why the work was done,
              what condition the item was in, or whether it was damaged before
              works began.
            </p>
            <Textarea
              id="context_notes"
              rows={3}
              {...register("context_notes")}
            />
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={loading || extracting}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
