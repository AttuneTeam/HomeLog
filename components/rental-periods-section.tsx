"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { RentalPeriod } from "@/lib/supabase/database.types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Building2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

type TimelineEntry =
  | { type: "rental"; period: RentalPeriod }
  | { type: "vacancy"; from: string; to: string; days: number };

function calcIncome(period: RentalPeriod): {
  totalIncome: number;
  totalFees: number | null;
  weeks: number;
} {
  const start = new Date(period.start_date);
  const end = period.end_date ? new Date(period.end_date) : new Date();
  const days = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
  const weeks = days / 7;
  const totalIncome = period.weekly_rent * weeks;
  const totalFees =
    period.management_fee_pct != null
      ? totalIncome * (period.management_fee_pct / 100)
      : null;
  return { totalIncome, totalFees, weeks };
}

function buildTimeline(periods: RentalPeriod[]): TimelineEntry[] {
  const sorted = [...periods].sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.end_date) {
        const gapStart = new Date(prev.end_date);
        const gapEnd = new Date(sorted[i].start_date);
        const days = Math.round(
          (gapEnd.getTime() - gapStart.getTime()) / 86_400_000,
        );
        if (days > 0) {
          entries.push({
            type: "vacancy",
            from: prev.end_date,
            to: sorted[i].start_date,
            days,
          });
        }
      }
    }
    entries.push({ type: "rental", period: sorted[i] });
  }
  return entries;
}

const schema = z.object({
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  weekly_rent: z.string().min(1, "Weekly rent is required"),
  management_company: z.string().optional(),
  agent_name: z.string().optional(),
  management_fee_pct: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; period: RentalPeriod };

interface RentalPeriodsSectionProps {
  propertyId: string;
  initialPeriods: RentalPeriod[];
}

export function RentalPeriodsSection({
  propertyId,
  initialPeriods,
}: RentalPeriodsSectionProps) {
  const [periods, setPeriods] = useState<RentalPeriod[]>(initialPeriods);
  const [dialogState, setDialogState] = useState<DialogState>({
    mode: "closed",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePeriod, setConfirmDeletePeriod] =
    useState<RentalPeriod | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function openAdd() {
    reset({
      start_date: "",
      end_date: "",
      weekly_rent: "",
      management_company: "",
      agent_name: "",
      management_fee_pct: "",
      notes: "",
    });
    setDialogState({ mode: "add" });
  }

  function openEdit(period: RentalPeriod) {
    reset({
      start_date: period.start_date,
      end_date: period.end_date ?? "",
      weekly_rent: String(period.weekly_rent),
      management_company: period.management_company ?? "",
      agent_name: period.agent_name ?? "",
      management_fee_pct:
        period.management_fee_pct != null
          ? String(period.management_fee_pct)
          : "",
      notes: period.notes ?? "",
    });
    setDialogState({ mode: "edit", period });
  }

  function closeDialog() {
    setDialogState({ mode: "closed" });
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      property_id: propertyId,
      start_date: values.start_date,
      end_date: values.end_date?.trim() || null,
      weekly_rent: parseFloat(values.weekly_rent),
      management_company: values.management_company?.trim() || null,
      agent_name: values.agent_name?.trim() || null,
      management_fee_pct: values.management_fee_pct?.trim()
        ? parseFloat(values.management_fee_pct)
        : null,
      notes: values.notes?.trim() || null,
    };

    if (dialogState.mode === "edit") {
      const { data, error } = await supabase
        .from("rental_periods")
        .update(payload)
        .eq("id", dialogState.period.id)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setPeriods((prev) =>
        prev.map((p) =>
          p.id === dialogState.period.id ? (data as RentalPeriod) : p,
        ),
      );
      toast.success("Rental period updated");
    } else {
      const { data, error } = await supabase
        .from("rental_periods")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setPeriods((prev) => [...prev, data as RentalPeriod]);
      toast.success("Rental period added");
    }

    setSaving(false);
    closeDialog();
  }

  async function handleDelete(period: RentalPeriod) {
    setDeletingId(period.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("rental_periods")
      .delete()
      .eq("id", period.id);
    if (error) {
      toast.error(error.message);
      setDeletingId(null);
      return;
    }
    setPeriods((prev) => prev.filter((p) => p.id !== period.id));
    toast.success("Rental period removed");
    setDeletingId(null);
  }

  const timeline = buildTimeline(periods);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Rental Periods</h2>
        <Button size="sm" onClick={openAdd} variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add period
        </Button>
      </div>

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <Calendar className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No rental periods yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Track when the property was rented and to whom
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {timeline.map((entry, i) => {
            if (entry.type === "vacancy") {
              return (
                <div
                  key={`vacancy-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground bg-muted/30"
                >
                  <div className="w-0.5 self-stretch bg-muted-foreground/20 rounded-full shrink-0" />
                  <span className="font-medium">Vacant</span>
                  <span>·</span>
                  <span>
                    {formatDate(entry.from)} → {formatDate(entry.to)}
                  </span>
                  <span>·</span>
                  <span>
                    {entry.days} day{entry.days !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            }

            const { period } = entry;
            const isExpanded = expandedId === period.id;
            const { totalIncome, totalFees, weeks } = calcIncome(period);
            return (
              <div
                key={period.id}
                className="rounded-lg border bg-white overflow-hidden"
              >
                {/* Collapsed / summary row */}
                <div className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="flex items-center gap-1 shrink-0"
                    onClick={() => setExpandedId(isExpanded ? null : period.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <div className="w-0.5 self-stretch bg-emerald-400 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {formatDate(period.start_date)}
                        {" → "}
                        {period.end_date
                          ? formatDate(period.end_date)
                          : "Present"}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                        {formatCurrency(period.weekly_rent)}/wk
                      </span>
                    </div>
                    {(period.management_company ||
                      period.agent_name ||
                      period.management_fee_pct != null) && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {period.management_company && (
                          <span>{period.management_company}</span>
                        )}
                        {period.management_company && period.agent_name && (
                          <span>·</span>
                        )}
                        {period.agent_name && <span>{period.agent_name}</span>}
                        {period.management_fee_pct != null && (
                          <>
                            <span>·</span>
                            <span>{period.management_fee_pct}% fee</span>
                          </>
                        )}
                      </div>
                    )}
                    {period.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {period.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 mt-3 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(period);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingId === period.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeletePeriod(period);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>

                {/* Expanded: income summary */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <TrendingUp className="h-3 w-3" />
                      Income summary
                      {!period.end_date && (
                        <span className="normal-case font-normal ml-1">
                          (to today)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Weeks leased
                        </p>
                        <p className="font-semibold text-sm">
                          {weeks.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Gross rental income
                        </p>
                        <p className="font-semibold text-sm text-emerald-700">
                          {formatCurrency(totalIncome)}
                        </p>
                      </div>
                      {totalFees != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Management fees ({period.management_fee_pct}%)
                          </p>
                          <p className="font-semibold text-sm text-red-600">
                            -{formatCurrency(totalFees)}
                          </p>
                        </div>
                      )}
                      {totalFees != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Net rental income
                          </p>
                          <p className="font-semibold text-sm">
                            {formatCurrency(totalIncome - totalFees)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "edit"
                ? "Edit rental period"
                : "Add rental period"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date">Start date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    {...register("start_date")}
                  />
                  {errors.start_date && (
                    <p className="text-xs text-destructive">
                      {errors.start_date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_date">End date </Label>
                  <Input id="end_date" type="date" {...register("end_date")} />
                  <span className="text-muted-foreground font-normal text-xs">
                    (leave empty if currently rented)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="weekly_rent">Weekly rent ($) *</Label>
                <Input
                  id="weekly_rent"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="500.00"
                  {...register("weekly_rent")}
                />
                {errors.weekly_rent && (
                  <p className="text-xs text-destructive">
                    {errors.weekly_rent.message}
                  </p>
                )}
              </div>

              <Separator />

              <p className="text-sm font-medium">Management</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="management_company">Company</Label>
                  <Input
                    id="management_company"
                    placeholder="Property management company"
                    {...register("management_company")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent_name">Agent</Label>
                  <Input
                    id="agent_name"
                    placeholder="Agent name"
                    {...register("agent_name")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="management_fee_pct">Management fee (%)</Label>
                <Input
                  id="management_fee_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="8.5"
                  {...register("management_fee_pct")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes…"
                  rows={2}
                  {...register("notes")}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : dialogState.mode === "edit"
                    ? "Save changes"
                    : "Add period"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeletePeriod !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeletePeriod(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove rental period?</DialogTitle>
          </DialogHeader>
          {confirmDeletePeriod && (
            <p className="text-sm text-muted-foreground">
              The period from {formatDate(confirmDeletePeriod.start_date)} to{" "}
              {confirmDeletePeriod.end_date
                ? formatDate(confirmDeletePeriod.end_date)
                : "present"}{" "}
              will be permanently deleted.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeletePeriod(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeletePeriod) handleDelete(confirmDeletePeriod);
                setConfirmDeletePeriod(null);
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
