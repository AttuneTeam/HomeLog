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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  FileText,
  Wrench,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

const CATEGORIES = [
  { value: "labour", label: "Labour" },
  { value: "materials", label: "Materials" },
  { value: "permits", label: "Permits" },
  { value: "professional_fees", label: "Professional fees" },
  { value: "appliances", label: "Appliances" },
  { value: "fixtures", label: "Fixtures" },
  { value: "other", label: "Other" },
] as const;

const schema = z.object({
  amount: z.string().min(1, "Amount is required"),
  gst_amount: z.string().optional(),
  category: z.enum([
    "labour",
    "materials",
    "permits",
    "professional_fees",
    "appliances",
    "fixtures",
    "other",
  ]),
  expense_date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  supplier: z.string().optional(),
  abn: z.string().optional(),
  classification_override: z.enum([
    "repair",
    "capital_improvement",
    "initial_repair",
    "inherit",
  ]),
  context_notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ExpenseFormProps {
  renovationId: string;
  propertyId: string;
  renovationClassification: string;
  userId: string;
  defaultValues?: Partial<FormValues> & {
    id?: string;
    invoice_path?: string | null;
    abn?: string | null;
    gst_amount?: number | null;
    context_notes?: string | null;
  };
}

export function ExpenseForm({
  renovationId,
  propertyId,
  renovationClassification,
  userId,
  defaultValues,
}: ExpenseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [existingInvoicePath, setExistingInvoicePath] = useState<string | null>(
    defaultValues?.invoice_path ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    watch,
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
      category: defaultValues?.category ?? "labour",
      expense_date:
        defaultValues?.expense_date ?? new Date().toISOString().split("T")[0],
      description: defaultValues?.description ?? "",
      supplier: defaultValues?.supplier ?? "",
      abn: defaultValues?.abn ?? "",
      classification_override:
        (defaultValues?.classification_override as
          | "repair"
          | "capital_improvement"
          | "initial_repair") ?? "inherit",
      context_notes: defaultValues?.context_notes ?? "",
    },
  });

  const classificationOverride = watch("classification_override");
  const effectiveClassification =
    classificationOverride === "inherit"
      ? renovationClassification
      : classificationOverride;

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
      category: values.category,
      expense_date: values.expense_date,
      description: values.description || null,
      supplier: values.supplier || null,
      abn: values.abn || null,
      invoice_path: invoicePath,
      classification_override:
        values.classification_override === "inherit"
          ? null
          : values.classification_override,
      context_notes: values.context_notes || null,
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
      router.push(`/properties/${propertyId}/renovations/${renovationId}`);
    } else {
      const { data: newExpense, error } = await supabase
        .from("expenses")
        .insert({ ...payload, renovation_id: renovationId })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Expense added");
      router.push(
        `/properties/${propertyId}/renovations/${renovationId}/expenses/${newExpense.id}`,
      );
    }
    router.refresh();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Total amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
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
                placeholder="0.00"
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
            <Label>Category *</Label>
            <Select
              defaultValue={defaultValues?.category ?? "labour"}
              onValueChange={(v) =>
                setValue("category", v as FormValues["category"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What was this expense for?"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Supplier / contractor</Label>
              <Input
                id="supplier"
                placeholder="ABC Plumbing"
                {...register("supplier")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abn">Supplier ABN</Label>
              <Input
                id="abn"
                placeholder="12 345 678 901"
                {...register("abn")}
              />
            </div>
          </div>

          {/* Classification override */}
          <div className="space-y-2">
            <Label>Tax classification override</Label>
            <p className="text-xs text-muted-foreground">
              Leave as &quot;Inherit&quot; to use the renovation&apos;s
              classification (
              {renovationClassification === "capital_improvement"
                ? "Capital Improvement"
                : renovationClassification === "initial_repair"
                  ? "Initial Repair"
                  : "Repair"}
              ). Override only if this specific expense differs.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { value: "inherit", label: "Inherit", desc: "From renovation" },
                {
                  value: "repair",
                  label: "Repair",
                  desc: "Immediate deduction",
                  icon: Wrench,
                },
                {
                  value: "initial_repair",
                  label: "Initial Repair",
                  desc: "At purchase — CGT base",
                  icon: ShieldAlert,
                },
                {
                  value: "capital_improvement",
                  label: "Capital",
                  desc: "Adds to cost base",
                  icon: TrendingUp,
                },
              ].map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setValue(
                      "classification_override",
                      value as FormValues["classification_override"],
                    )
                  }
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs transition-all",
                    classificationOverride === value
                      ? value === "inherit"
                        ? "border-primary bg-primary/5"
                        : value === "repair"
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40"
                          : value === "initial_repair"
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40"
                            : "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                      : "border-border hover:border-muted-foreground/30",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground text-center">
                    {desc}
                  </span>
                </button>
              ))}
            </div>
            {classificationOverride !== "inherit" && (
              <p className="text-xs text-muted-foreground">
                Effective:{" "}
                <strong>
                  {effectiveClassification === "capital_improvement"
                    ? "Capital Improvement"
                    : effectiveClassification === "initial_repair"
                      ? "Initial Repair (at purchase)"
                      : "Repair"}
                </strong>
              </p>
            )}
          </div>

          {/* Invoice upload */}
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
          {/* AI context notes */}
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
              placeholder="e.g. Asbestos sheeting on garage was damaged and required removal. Replacement with blueboard was necessary as the structure could not be left exposed."
              rows={3}
              {...register("context_notes")}
            />
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={loading}>
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
