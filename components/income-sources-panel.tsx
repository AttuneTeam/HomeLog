"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { saveIncomeSources } from "@/app/actions/income-sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
  sort_order: number;
}

interface Row {
  key: string;
  label: string;
  amount: string;
}

function rowsFromSources(sources: IncomeSource[]): Row[] {
  if (sources.length === 0) return [];
  return sources
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ key: s.id, label: s.label, amount: String(s.amount) }));
}

let nextKey = 0;
function newKey() {
  return `new-${++nextKey}`;
}

interface Props {
  initialSources: IncomeSource[];
}

export function IncomeSourcesPanel({ initialSources }: Props) {
  const [rows, setRows] = useState<Row[]>(() => rowsFromSources(initialSources));
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();

  function addRow() {
    setRows((prev) => [...prev, { key: newKey(), label: "", amount: "" }]);
    setSaved(false);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSaved(false);
  }

  function updateRow(key: string, field: "label" | "amount", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
    setSaved(false);
  }

  function handleSave() {
    const sources = rows
      .filter((r) => r.label.trim() || Number(r.amount) > 0)
      .map((r) => ({
        label: r.label.trim() || "Income",
        amount: parseFloat(r.amount) || 0,
      }));

    startTransition(async () => {
      await saveIncomeSources(sources);
      setSaved(true);
    });
  }

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">Household Income</CardTitle>
          <span className="text-xs text-muted-foreground">
            Used to estimate your tax position
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-1">
            No income sources added yet. Add each earner or income stream below.
          </p>
        )}

        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <Input
              placeholder="e.g. Raul salary, Partner salary, Freelance"
              value={row.label}
              onChange={(e) => updateRow(row.key, "label", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <div className="relative w-36 shrink-0">
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
            Add income source
          </Button>

          <div className="flex items-center gap-4">
            {total > 0 && (
              <span className="text-sm">
                <span className="text-muted-foreground mr-1.5">Total</span>
                <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
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
              ) : (
                isPending ? "Saving…" : "Save"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
