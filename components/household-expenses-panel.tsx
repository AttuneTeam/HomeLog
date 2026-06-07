"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  saveHouseholdExpenses,
  type ExpenseFrequency,
} from "@/app/actions/household-expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface HouseholdExpense {
  id: string;
  label: string;
  amount: number;
  frequency: ExpenseFrequency;
  sort_order: number;
}

interface Row {
  key: string;
  label: string;
  amount: string;
  frequency: ExpenseFrequency;
}

function rowsFromExpenses(expenses: HouseholdExpense[]): Row[] {
  if (expenses.length === 0) return [];
  return expenses
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({
      key: e.id,
      label: e.label,
      amount: String(e.amount),
      frequency: e.frequency,
    }));
}

let nextKey = 0;
function newKey() {
  return `new-${++nextKey}`;
}

function toMonthly(amount: number, frequency: ExpenseFrequency): number {
  if (frequency === "quarterly") return amount / 3;
  if (frequency === "yearly") return amount / 12;
  return amount;
}

interface Props {
  initialExpenses: HouseholdExpense[];
  financialYearEnd: number;
}

export function HouseholdExpensesPanel({ initialExpenses, financialYearEnd }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromExpenses(initialExpenses),
  );
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: newKey(), label: "", amount: "", frequency: "monthly" },
    ]);
    setSaved(false);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSaved(false);
  }

  function updateRow(
    key: string,
    field: "label" | "amount" | "frequency",
    value: string,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
    setSaved(false);
  }

  function handleSave() {
    const expenses = rows
      .filter((r) => r.label.trim() || Number(r.amount) > 0)
      .map((r) => ({
        label: r.label.trim() || "Expense",
        amount: parseFloat(r.amount) || 0,
        frequency: r.frequency,
      }));

    startTransition(async () => {
      await saveHouseholdExpenses(financialYearEnd, expenses);
      setSaved(true);
    });
  }

  const totalMonthly = rows.reduce(
    (sum, r) => sum + toMonthly(parseFloat(r.amount) || 0, r.frequency),
    0,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">
            Household Expenses
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Factored into your monthly cash flow
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-1">
            No expenses added yet. Add recurring bills, subscriptions, and
            living costs below.
          </p>
        )}

        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <Input
              placeholder="e.g. Phone, Netflix, Electricity"
              value={row.label}
              onChange={(e) => updateRow(row.key, "label", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <div className="relative w-32 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                $
              </span>
              <Input
                type="number"
                placeholder="0"
                value={row.amount}
                onChange={(e) => updateRow(row.key, "amount", e.target.value)}
                className="h-8 text-sm pl-6 tabular-nums"
                min={0}
              />
            </div>
            <Select
              value={row.frequency}
              onValueChange={(v) => updateRow(row.key, "frequency", v as string)}
            >
              <SelectTrigger className="w-28 h-8 text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(row.key)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1 gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground px-0"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Add expense
          </Button>

          <div className="flex items-center gap-4">
            {totalMonthly > 0 && (
              <span className="text-sm">
                <span className="text-muted-foreground mr-1.5">
                  Total/month
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(totalMonthly)}
                </span>
              </span>
            )}
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleSave}
              disabled={isPending || saved}
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : isPending ? (
                "Saving…"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
