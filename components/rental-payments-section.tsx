"use client";

import { useState } from "react";
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
import { Banknote, Plus, Trash2, Mail } from "lucide-react";

export interface RentalPayment {
  id: string;
  property_id: string;
  rental_period_id: string | null;
  payment_date: string;
  amount: number;
  period_start: string | null;
  period_end: string | null;
  source_email_id: string | null;
  raw_subject: string | null;
  notes: string | null;
  created_at: string;
}

const schema = z.object({
  payment_date: z.string().min(1, "Payment date is required"),
  amount: z.string().min(1, "Amount is required"),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RentalPaymentsSectionProps {
  propertyId: string;
  initialPayments: RentalPayment[];
}

export function RentalPaymentsSection({
  propertyId,
  initialPayments,
}: RentalPaymentsSectionProps) {
  const [payments, setPayments] = useState<RentalPayment[]>(initialPayments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RentalPayment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function openAdd() {
    reset({ payment_date: "", amount: "", period_start: "", period_end: "", notes: "" });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      property_id: propertyId,
      payment_date: values.payment_date,
      amount: parseFloat(values.amount),
      period_start: values.period_start?.trim() || null,
      period_end: values.period_end?.trim() || null,
      notes: values.notes?.trim() || null,
    };
    // rental_payments not yet in generated DB types — cast until types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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
      [...prev, data as RentalPayment].sort(
        (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
      ),
    );
    toast.success("Rental payment added");
    setSaving(false);
    setDialogOpen(false);
  }

  async function handleDelete(payment: RentalPayment) {
    setDeletingId(payment.id);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("rental_payments").delete().eq("id", payment.id);
    if (error) {
      toast.error(error.message);
      setDeletingId(null);
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    toast.success("Rental payment removed");
    setDeletingId(null);
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Rental payments</h3>
          {payments.length > 0 && (
            <span className="text-sm text-muted-foreground">
              · {formatCurrency(total)} received
            </span>
          )}
        </div>
        <Button size="sm" onClick={openAdd} variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add payment
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <Banknote className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No rental payments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Payments forwarded from your agent appear here automatically, or add them manually
            </p>
          </div>
        </div>
      ) : (
        <div>
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
                  Amount
                </th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-2">
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
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="px-1 py-1.5 text-muted-foreground whitespace-nowrap">
                    {payment.period_start || payment.period_end ? (
                      <>
                        {payment.period_start ? formatDate(payment.period_start) : "?"}
                        {" → "}
                        {payment.period_end ? formatDate(payment.period_end) : "?"}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-1 py-1.5 tabular-nums text-right whitespace-nowrap">
                    {formatCurrency(Number(payment.amount))}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deletingId === payment.id}
                        onClick={() => setConfirmDelete(payment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add rental payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="payment_date">Payment date *</Label>
                <Input id="payment_date" type="date" {...register("payment_date")} />
                {errors.payment_date && (
                  <p className="text-xs text-destructive">{errors.payment_date.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="2000.00"
                  {...register("amount")}
                />
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
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} placeholder="Any additional notes…" {...register("notes")} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove rental payment?</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <p className="text-sm text-muted-foreground">
              The {formatCurrency(Number(confirmDelete.amount))} payment on{" "}
              {formatDate(confirmDelete.payment_date)} will be permanently deleted.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deletingId !== null}>
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
