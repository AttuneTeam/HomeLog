"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
  AlertTriangle,
  Banknote,
  CheckCircle2,
  FileText,
  FileX,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { reconcileStatement } from "@/lib/tax/statement-reconciliation";
import {
  confirmRentalStatement,
  removeRentalStatement,
  rentalStatementUrl,
} from "@/app/actions/rental-statements";
import type { RentalPayment } from "@/lib/supabase/database.types";

export type { RentalPayment };

/** Marker written by scripts/fix-rental-payment-gross-net.ts. */
const NEEDS_VERIFICATION = "NEEDS VERIFICATION";

const schema = z.object({
  raw_subject: z.string().optional(),
  payment_date: z.string().min(1, "Payment date is required"),
  amount: z.string().min(1, "Gross rent is required"),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  management_fees: z.string().optional(),
  letting_fees: z.string().optional(),
  lease_fees: z.string().optional(),
  sundry_fees: z.string().optional(),
  other_outgoings: z.string().optional(),
  other_income: z.string().optional(),
  other_income_note: z.string().optional(),
  net_received: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** "" and undefined mean not stated, which is null — never 0. */
function toNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value: string | undefined): number {
  return toNumber(value) ?? 0;
}

function hasFees(payment: RentalPayment): boolean {
  return (
    payment.management_fees != null ||
    payment.letting_fees != null ||
    payment.lease_fees != null ||
    payment.sundry_fees != null
  );
}

function totalFees(payment: RentalPayment): number {
  return (
    Number(payment.management_fees ?? 0) +
    Number(payment.letting_fees ?? 0) +
    Number(payment.lease_fees ?? 0) +
    Number(payment.sundry_fees ?? 0)
  );
}

interface RentalPaymentsSectionProps {
  propertyId: string;
  initialPayments: RentalPayment[];
  /** 1-based month the user's financial year starts in. */
  fyStartMonth: number;
  /** Day of that month the user's financial year starts on. */
  fyStartDay: number;
}

export function RentalPaymentsSection({
  propertyId,
  initialPayments,
  fyStartMonth,
  fyStartDay,
}: RentalPaymentsSectionProps) {
  const [payments, setPayments] = useState<RentalPayment[]>(initialPayments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RentalPayment | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RentalPayment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const empty: FormValues = {
    raw_subject: "",
    payment_date: "",
    amount: "",
    period_start: "",
    period_end: "",
    management_fees: "",
    letting_fees: "",
    lease_fees: "",
    sundry_fees: "",
    other_outgoings: "",
    other_income: "",
    other_income_note: "",
    net_received: "",
    notes: "",
  };

  function openAdd() {
    setEditingPayment(null);
    reset(empty);
    setDialogOpen(true);
  }

  const str = (v: number | null) => (v != null ? String(v) : "");

  function openEdit(payment: RentalPayment) {
    setEditingPayment(payment);
    reset({
      raw_subject: payment.raw_subject ?? "",
      payment_date: payment.payment_date,
      amount: String(payment.amount),
      period_start: payment.period_start ?? "",
      period_end: payment.period_end ?? "",
      management_fees: str(payment.management_fees),
      letting_fees: str(payment.letting_fees),
      lease_fees: str(payment.lease_fees),
      sundry_fees: str(payment.sundry_fees),
      other_outgoings: str(payment.other_outgoings),
      other_income: str(payment.other_income),
      other_income_note: payment.other_income_note ?? "",
      net_received: str(payment.net_received),
      notes: payment.notes ?? "",
    });
    setDialogOpen(true);
  }

  function replaceInList(row: RentalPayment) {
    setPayments((prev) =>
      prev
        .map((p) => (p.id === row.id ? row : p))
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
    );
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const supabase = createClient();
    const feeFields = {
      management_fees: toNumber(values.management_fees),
      letting_fees: toNumber(values.letting_fees),
      lease_fees: toNumber(values.lease_fees),
      sundry_fees: toNumber(values.sundry_fees),
      other_outgoings: toNumber(values.other_outgoings),
      other_income: toNumber(values.other_income),
      other_income_note: values.other_income_note?.trim() || null,
      net_received: toNumber(values.net_received),
    };
    const anyFee =
      feeFields.management_fees != null ||
      feeFields.letting_fees != null ||
      feeFields.lease_fees != null ||
      feeFields.sundry_fees != null;

    const payload = {
      property_id: propertyId,
      raw_subject: values.raw_subject?.trim() || null,
      payment_date: values.payment_date,
      // GROSS rent — the assessable figure. What the agent disbursed goes in
      // net_received.
      amount: num(values.amount),
      period_start: values.period_start?.trim() || null,
      period_end: values.period_end?.trim() || null,
      notes: values.notes?.trim() || null,
      ...feeFields,
      // Typed by a human, so confirmed on save. An AI extraction is what needs a
      // separate review step, not manual entry.
      fees_confirmed_at: anyFee ? new Date().toISOString() : null,
    };

    if (editingPayment) {
      const { data, error } = await supabase
        .from("rental_payments")
        .update(payload)
        .eq("id", editingPayment.id)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      replaceInList(data);
      toast.success("Rental payment updated");
    } else {
      const { data, error } = await supabase
        .from("rental_payments")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setPayments((prev) =>
        [...prev, data].sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
      );
      toast.success("Rental payment added");
    }

    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(payment: RentalPayment) {
    setDeletingId(payment.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("rental_payments")
      .delete()
      .eq("id", payment.id);
    if (error) {
      toast.error(error.message);
      setDeletingId(null);
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    toast.success("Rental payment removed");
    setDeletingId(null);
  }

  function pickStatement(paymentId: string) {
    uploadTargetRef.current = paymentId;
    fileInputRef.current?.click();
  }

  async function handleStatementSelected(file: File) {
    const paymentId = uploadTargetRef.current;
    if (!paymentId) return;
    setUploadingId(paymentId);

    const form = new FormData();
    form.set("file", file);
    form.set("paymentId", paymentId);

    try {
      const res = await fetch("/api/rental-statements/extract", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Couldn't upload the statement.");
        return;
      }
      replaceInList(json.payment);
      if (json.extractionError) {
        toast.warning(
          "Statement saved, but the figures couldn't be read. Enter them by hand.",
        );
      } else {
        toast.success("Statement read — review the figures, then confirm.");
      }
    } catch {
      toast.error("Couldn't upload the statement.");
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleConfirm(payment: RentalPayment) {
    setConfirmingId(payment.id);
    startTransition(async () => {
      const { error } = await confirmRentalStatement({
        id: payment.id,
        propertyId,
        grossRent: Number(payment.amount),
        managementFees: payment.management_fees,
        lettingFees: payment.letting_fees,
        leaseFees: payment.lease_fees,
        sundryFees: payment.sundry_fees,
        otherOutgoings: payment.other_outgoings,
        otherIncome: payment.other_income,
        otherIncomeNote: payment.other_income_note,
        netReceived: payment.net_received,
      });
      setConfirmingId(null);
      if (error) {
        toast.error(error);
        return;
      }
      replaceInList({ ...payment, fees_confirmed_at: new Date().toISOString() });
      toast.success("Fees confirmed — now claimed in the tax pack.");
    });
  }

  function handleRemoveStatement(payment: RentalPayment) {
    startTransition(async () => {
      const { error } = await removeRentalStatement(payment.id, propertyId);
      if (error) {
        toast.error(error);
        return;
      }
      replaceInList({
        ...payment,
        statement_path: null,
        management_fees: null,
        letting_fees: null,
        lease_fees: null,
        sundry_fees: null,
        other_outgoings: null,
        other_income: null,
        other_income_note: null,
        net_received: null,
        extracted: null,
        confidence: null,
        fees_confirmed_at: null,
      });
      toast.success("Statement removed. The payment itself is unchanged.");
    });
  }

  async function openStatement(path: string) {
    const { url, error } = await rentalStatementUrl(path);
    if (error || !url) {
      toast.error(error ?? "Couldn't open the statement.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalFeesAll = payments.reduce((sum, p) => sum + totalFees(p), 0);
  const unconfirmed = payments.filter(
    (p) => hasFees(p) && p.fees_confirmed_at == null,
  ).length;
  const flagged = payments.filter((p) =>
    p.notes?.includes(NEEDS_VERIFICATION),
  ).length;

  // Live reconciliation inside the dialog, from whatever is currently typed.
  const live = reconcileStatement({
    amount: num(watch("amount")),
    management_fees: toNumber(watch("management_fees")),
    letting_fees: toNumber(watch("letting_fees")),
    lease_fees: toNumber(watch("lease_fees")),
    sundry_fees: toNumber(watch("sundry_fees")),
    other_outgoings: toNumber(watch("other_outgoings")),
    other_income: toNumber(watch("other_income")),
    net_received: toNumber(watch("net_received")),
  });

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleStatementSelected(file);
        }}
      />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Rental payments</h3>
          {payments.length > 0 && (
            <span className="text-sm text-muted-foreground">
              · {formatCurrency(total)} gross rent
              {totalFeesAll > 0 && <> · {formatCurrency(totalFeesAll)} agent fees</>}
            </span>
          )}
        </div>
        <Button size="sm" onClick={openAdd} variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add payment
        </Button>
      </div>

      {(unconfirmed > 0 || flagged > 0) && (
        <div className="mb-4 space-y-2">
          {unconfirmed > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-amber-900 dark:text-amber-200">
                {unconfirmed} statement{unconfirmed > 1 ? "s" : ""} awaiting
                confirmation. Until you confirm, the agent fees aren&apos;t claimed —
                the tax pack falls back to the percentage estimate.
              </p>
            </div>
          )}
          {flagged > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-amber-900 dark:text-amber-200">
                {flagged} payment{flagged > 1 ? "s" : ""} may hold the amount the
                agent disbursed rather than gross rent, which understates income.
                Attach the statement to recover the correct figures.
              </p>
            </div>
          )}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <Banknote className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No rental payments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Payments forwarded from your agent appear here automatically, or add
              them manually
            </p>
          </div>
        </div>
      ) : (
        // Horizontal scrolling is confined to widths where this five-column
        // table cannot fit. It is not applied at sm and above because
        // overflow-x:auto forces the computed overflow-y to auto as well,
        // making the wrapper a scroll container — a position:sticky row inside
        // it then anchors to the wrapper rather than the viewport, and the
        // wrapper never scrolls vertically, so the year dividers would never
        // pin. Below sm the divider degrades to a plain, non-sticky row.
        <div className="max-sm:overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-1 pb-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payment
                </th>
                <th className="px-1 pb-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Date
                </th>
                <th className="px-1 pb-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Period
                </th>
                <th className="px-1 pb-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Gross rent
                </th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => {
                const fees = totalFees(payment);
                const feesPresent = hasFees(payment);
                const confirmed = payment.fees_confirmed_at != null;
                const rec = reconcileStatement(payment);
                const needsVerification =
                  payment.notes?.includes(NEEDS_VERIFICATION) ?? false;
                return (
                  <tr key={payment.id}>
                    <td className="px-1 py-1.5 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{payment.raw_subject ?? "Rent payment"}</span>
                        {payment.source_email_id && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title="Imported automatically from a forwarded agent email"
                          >
                            <Mail className="h-3 w-3" />
                            Auto
                          </span>
                        )}
                        {payment.statement_path && (
                          <button
                            type="button"
                            onClick={() => openStatement(payment.statement_path!)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            title="Open the statement"
                          >
                            <FileText className="h-3 w-3" />
                            Statement
                          </button>
                        )}
                        {needsVerification && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                            title="This amount may be the net disbursed rather than gross rent"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Unverified
                          </span>
                        )}
                      </div>

                      {feesPresent && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                          <span>{formatCurrency(fees)} fees</span>
                          {payment.other_outgoings != null && (
                            <>
                              <span>·</span>
                              <span
                                title="Paid by the agent to a third party. Deducted via its own invoice, not here."
                              >
                                {formatCurrency(Number(payment.other_outgoings))}{" "}
                                third party
                              </span>
                            </>
                          )}
                          {payment.other_income != null && (
                            <>
                              <span>·</span>
                              <span title={payment.other_income_note ?? undefined}>
                                {formatCurrency(Number(payment.other_income))} other
                                income
                              </span>
                            </>
                          )}
                          {payment.net_received != null && (
                            <>
                              <span>·</span>
                              <span>
                                {formatCurrency(Number(payment.net_received))} received
                              </span>
                            </>
                          )}
                          {rec.applicable && (
                            <span
                              className={
                                rec.ties
                                  ? "inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                                  : "inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
                              }
                              title={
                                rec.ties
                                  ? "Gross rent less fees and outgoings matches the amount received"
                                  : `Off by ${formatCurrency(Math.abs(rec.difference))}. A balance brought forward can cause this.`
                              }
                            >
                              {rec.ties ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Reconciles
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3" />
                                  Out by{" "}
                                  {formatCurrency(Math.abs(rec.difference))}
                                </>
                              )}
                            </span>
                          )}
                          {confirmed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              Not confirmed
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-muted-foreground whitespace-nowrap align-top">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-1 py-1.5 text-muted-foreground whitespace-nowrap align-top">
                      {payment.period_start || payment.period_end ? (
                        <>
                          {payment.period_start
                            ? formatDate(payment.period_start)
                            : "?"}
                          {" → "}
                          {payment.period_end ? formatDate(payment.period_end) : "?"}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-1 py-1.5 tabular-nums text-right whitespace-nowrap align-top">
                      {formatCurrency(Number(payment.amount))}
                    </td>
                    {/* Actions stay on one row. The table scrolls horizontally
                        when narrow, which is the wanted overflow behaviour —
                        wrapping here stacked the buttons into a column. */}
                    <td className="px-2 py-1.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        {feesPresent && !confirmed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={confirmingId === payment.id}
                            onClick={() => handleConfirm(payment)}
                          >
                            {confirmingId === payment.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Confirm fees"
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground shrink-0"
                          disabled={uploadingId === payment.id}
                          title={
                            payment.statement_path
                              ? "Replace the statement"
                              : "Attach the agent's statement"
                          }
                          onClick={() => pickStatement(payment.id)}
                        >
                          {uploadingId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                        {payment.statement_path && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            title="Remove the statement (keeps the payment)"
                            onClick={() => handleRemoveStatement(payment)}
                          >
                            <FileX className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground shrink-0"
                          onClick={() => openEdit(payment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          disabled={deletingId === payment.id}
                          onClick={() => setConfirmDelete(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <span className="text-muted-foreground">Total</span>
                </td>
                <td></td>
                <td></td>
                <td className="px-1 py-1.5 tabular-nums text-right whitespace-nowrap">
                  <span className="font-semibold">{formatCurrency(total)}</span>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? "Edit rental payment" : "Add rental payment"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="raw_subject">Title</Label>
                <Input
                  id="raw_subject"
                  placeholder="Rental income statement #1"
                  {...register("raw_subject")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment_date">Payment date *</Label>
                <Input id="payment_date" type="date" {...register("payment_date")} />
                {errors.payment_date && (
                  <p className="text-xs text-destructive">
                    {errors.payment_date.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Gross rent ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="4400.00"
                  {...register("amount")}
                />
                <p className="text-xs text-muted-foreground">
                  Rent collected from the tenant before the agent&apos;s deductions —
                  the &ldquo;Money In&rdquo; total. Not the amount that reached your
                  bank; that goes in &ldquo;Received&rdquo; below.
                </p>
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="period_start">Period start</Label>
                  <Input id="period_start" type="date" {...register("period_start")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="period_end">Period end</Label>
                  <Input id="period_end" type="date" {...register("period_end")} />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium">Agent fees</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  As printed on the statement, including GST. Leave blank if not
                  charged.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="management_fees">Management</Label>
                    <Input
                      id="management_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("management_fees")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="letting_fees">Letting</Label>
                    <Input
                      id="letting_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("letting_fees")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lease_fees">Lease preparation</Label>
                    <Input
                      id="lease_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("lease_fees")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sundry_fees">Bank &amp; sundries</Label>
                    <Input
                      id="sundry_fees"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("sundry_fees")}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="other_outgoings">Paid to third parties ($)</Label>
                  <Input
                    id="other_outgoings"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("other_outgoings")}
                  />
                  <p className="text-xs text-muted-foreground">
                    What the agent paid tradespeople or suppliers on your behalf.
                    Recorded so the statement balances — it is <em>not</em> deducted
                    here, because those costs are claimed from their own invoices.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="other_income">Other income ($)</Label>
                    <Input
                      id="other_income"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("other_income")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="other_income_note">What for</Label>
                    <Input
                      id="other_income_note"
                      placeholder="Water usage recovered"
                      {...register("other_income_note")}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Money in that isn&apos;t rent, such as water usage the tenant
                  reimbursed. Assessable income, reported on its own line.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="net_received">Received ($)</Label>
                  <Input
                    id="net_received"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("net_received")}
                  />
                  <p className="text-xs text-muted-foreground">
                    What the agent actually paid you — &ldquo;You Received&rdquo; or
                    the EFT amount.
                  </p>
                </div>

                {live.applicable && (
                  <div
                    className={
                      live.ties
                        ? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30"
                        : "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30"
                    }
                  >
                    {live.ties ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div
                      className={
                        live.ties
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-amber-900 dark:text-amber-200"
                      }
                    >
                      <p className="tabular-nums">
                        {formatCurrency(live.totalMoneyIn)} in −{" "}
                        {formatCurrency(live.totalFees)} fees −{" "}
                        {formatCurrency(live.otherOutgoings)} third party ={" "}
                        {formatCurrency(live.computedNet)}
                      </p>
                      <p className="mt-0.5">
                        {live.ties
                          ? "Balances against what you received."
                          : `Out by ${formatCurrency(Math.abs(live.difference))} — a balance brought forward can cause this. You can still save.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Any additional notes…"
                  {...register("notes")}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingPayment ? "Save changes" : "Add payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove rental payment?</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <p className="text-sm text-muted-foreground">
              The {formatCurrency(Number(confirmDelete.amount))} payment on{" "}
              {formatDate(confirmDelete.payment_date)} will be permanently deleted
              {confirmDelete.statement_path && ", along with its statement"}. This
              reduces the rental income reported for the year.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) handleDelete(confirmDelete);
                setConfirmDelete(null);
              }}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
