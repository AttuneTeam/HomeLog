"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  addLoanInterestRate,
  deleteLoanInterestRate,
} from "@/app/actions/loan-interest-rates";
import { saveLoanDetails } from "@/app/actions/property-loans";
import { saveOffsetAccounts } from "@/app/actions/property-offset-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LoanInterestRate {
  id: string;
  property_id: string;
  rate: number;
  effective_date: string;
  notes: string | null;
}

export interface PropertyLoan {
  loan_amount: number;
  loan_term_years: number;
}

export interface OffsetAccount {
  id: string;
  label: string;
  balance: number;
}

interface OffsetRow {
  key: string;
  label: string;
  balance: string;
}

interface Props {
  propertyId: string;
  initialRates: LoanInterestRate[];
  initialLoan: PropertyLoan | null;
  initialOffsets: OffsetAccount[];
}

let nextOffsetKey = 0;
function newOffsetKey() {
  return `offset-${++nextOffsetKey}`;
}

export function LoanInterestRatesSection({
  propertyId,
  initialRates,
  initialLoan,
  initialOffsets,
}: Props) {
  // Offset accounts state
  const [offsetRows, setOffsetRows] = useState<OffsetRow[]>(() =>
    initialOffsets.map((o) => ({
      key: o.id,
      label: o.label,
      balance: String(o.balance),
    })),
  );
  const [offsetSaved, setOffsetSaved] = useState(true);
  const [offsetPending, startOffsetTransition] = useTransition();

  function addOffsetRow() {
    setOffsetRows((prev) => [
      ...prev,
      { key: newOffsetKey(), label: "", balance: "" },
    ]);
    setOffsetSaved(false);
  }

  function removeOffsetRow(key: string) {
    setOffsetRows((prev) => prev.filter((r) => r.key !== key));
    setOffsetSaved(false);
  }

  function updateOffsetRow(
    key: string,
    field: "label" | "balance",
    value: string,
  ) {
    setOffsetRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
    setOffsetSaved(false);
  }

  function handleSaveOffsets() {
    startOffsetTransition(async () => {
      await saveOffsetAccounts(
        propertyId,
        offsetRows
          .filter((r) => r.label.trim())
          .map((r) => ({
            label: r.label.trim(),
            balance: parseFloat(r.balance) || 0,
          })),
      );
      setOffsetSaved(true);
    });
  }

  const totalOffset = offsetRows.reduce(
    (s, r) => s + (parseFloat(r.balance) || 0),
    0,
  );
  const loanAmountNum = initialLoan?.loan_amount ?? 0;

  // Loan details state
  const [editingLoan, setEditingLoan] = useState(!initialLoan);
  const [loanAmount, setLoanAmount] = useState(
    initialLoan ? String(initialLoan.loan_amount) : "",
  );
  const [loanTerm, setLoanTerm] = useState(
    initialLoan ? String(initialLoan.loan_term_years) : "",
  );
  const [loanPending, startLoanTransition] = useTransition();

  // Rate history state
  const [showRateForm, setShowRateForm] = useState(false);
  const [rate, setRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [ratePending, startRateTransition] = useTransition();

  const sorted = [...initialRates].sort(
    (a, b) =>
      new Date(a.effective_date).getTime() -
      new Date(b.effective_date).getTime(),
  );

  function handleSaveLoan() {
    const amount = parseFloat(loanAmount);
    const term = parseInt(loanTerm, 10);
    if (!amount || !term) return;
    startLoanTransition(async () => {
      await saveLoanDetails(propertyId, amount, term);
      setEditingLoan(false);
    });
  }

  function handleAddRate() {
    const rateNum = parseFloat(rate);
    if (!rateNum || !effectiveDate) return;
    startRateTransition(async () => {
      await addLoanInterestRate(
        propertyId,
        rateNum,
        effectiveDate,
        notes || undefined,
      );
      setRate("");
      setEffectiveDate("");
      setNotes("");
      setShowRateForm(false);
    });
  }

  function handleDeleteRate(id: string) {
    startRateTransition(async () => {
      await deleteLoanInterestRate(id, propertyId);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Loan Details</h2>
      </div>

      {/* Loan details */}
      <div className="rounded-lg border p-4 mb-4 bg-muted/20">
        {editingLoan ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Loan details</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount borrowed</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    $
                  </span>
                  <Input
                    type="number"
                    placeholder="e.g. 560000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="h-8 text-sm pl-6 tabular-nums"
                    min={0}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loan term (years)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 30"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                  className="h-8 text-sm"
                  min={1}
                  max={40}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleSaveLoan}
                disabled={loanPending || !loanAmount || !loanTerm}
              >
                <Check className="h-3.5 w-3.5" />
                {loanPending ? "Saving…" : "Save"}
              </Button>
              {initialLoan && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setLoanAmount(String(initialLoan.loan_amount));
                    setLoanTerm(String(initialLoan.loan_term_years));
                    setEditingLoan(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <span>
                <span className="text-muted-foreground mr-2">
                  Amount borrowed
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(initialLoan?.loan_amount)}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground mr-2">Loan term</span>
                <span className="font-semibold">
                  {initialLoan!.loan_term_years} years
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-muted-foreground"
              onClick={() => setEditingLoan(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Offset accounts */}
      <div className="rounded-lg border p-4 mb-4 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Offset accounts</p>
          {totalOffset > 0 && loanAmountNum > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Effective balance:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(Math.max(0, loanAmountNum - totalOffset))}
              </span>
            </span>
          )}
        </div>

        {offsetRows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No offset accounts added. Add each account below.
          </p>
        )}

        {offsetRows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <Input
              placeholder="e.g. Westpac offset, Joint savings"
              value={row.label}
              onChange={(e) => updateOffsetRow(row.key, "label", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <div className="relative w-36 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                $
              </span>
              <Input
                type="number"
                placeholder="0"
                value={row.balance}
                onChange={(e) =>
                  updateOffsetRow(row.key, "balance", e.target.value)
                }
                className="h-8 text-sm pl-6 tabular-nums"
                min={0}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => removeOffsetRow(row.key)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {totalOffset > 0 && loanAmountNum > 0 && totalOffset >= loanAmountNum && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Offset balance meets or exceeds loan — no interest accrues
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground px-0"
            onClick={addOffsetRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Add offset account
          </Button>
          <div className="flex items-center gap-4">
            {totalOffset > 0 && (
              <span className="text-sm">
                <span className="text-muted-foreground mr-1.5">Total offset</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalOffset)}
                </span>
              </span>
            )}
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleSaveOffsets}
              disabled={offsetPending || offsetSaved}
            >
              {offsetSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : offsetPending ? (
                "Saving…"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Rate history */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Rate history
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRateForm((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add rate change
        </Button>
      </div>

      {sorted.length === 0 && !showRateForm && (
        <p className="text-sm text-muted-foreground">
          No rate history recorded. Add each rate change to track your actual
          interest costs.
        </p>
      )}

      {sorted.length > 0 && (
        <div>
          <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-x-8 px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Rate (p.a.)</span>
            <span>Effective from</span>
            <span>Notes</span>
            <span />
          </div>
          <div className="divide-y">
            {sorted.map((r, i) => {
              const isCurrent = i === sorted.length - 1;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_1fr_2fr_auto] gap-x-8 items-center px-1 py-1"
                >
                  <span className="text-sm font-medium tabular-nums">
                    {r.rate.toFixed(2)}%
                    {isCurrent && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        current
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(r.effective_date)}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {r.notes ?? "—"}
                  </span>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => handleDeleteRate(r.id)}
                    disabled={ratePending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showRateForm && (
        <div className="mt-3 rounded-lg border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">New rate change</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Rate (% p.a.)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 6.25"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Effective from</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                placeholder="e.g. RBA rate rise"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8"
              onClick={handleAddRate}
              disabled={ratePending || !rate || !effectiveDate}
            >
              {ratePending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setShowRateForm(false);
                setRate("");
                setEffectiveDate("");
                setNotes("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
