"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Expense = {
  id: string;
  description: string | null;
  expense_date: string | null;
  amount: number;
  manual_classification: string | null;
  supplier: string | null;
};

type Renovation = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  expenses?: Expense[];
};

interface RenovationsListProps {
  renovations: Renovation[];
  propertyId: string;
}

const STATUS_ORDER = ["in_progress", "planned", "completed"] as const;

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

export function RenovationsList({
  renovations,
  propertyId,
}: RenovationsListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const byStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, renovations.filter((r) => r.status === s)]),
  );

  const sections = STATUS_ORDER.filter((s) => byStatus[s].length > 0);

  return (
    <div className="space-y-5">
      {sections.map((status) => (
        <div key={status}>
          <div className="flex items-center gap-2 px-1 pb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {STATUS_LABELS[status]}
            </span>
            <span className="text-xs text-muted-foreground">
              ({byStatus[status].length})
            </span>
          </div>
          {(() => {
            const sectionTotal = byStatus[status].reduce(
              (s, r) =>
                s + (r.expenses?.reduce((a, e) => a + Number(e.amount), 0) ?? 0),
              0,
            );
            return (
          <>
          <div className="divide-y">
            {byStatus[status].map((renovation) => {
              const total =
                renovation.expenses?.reduce(
                  (s, e) => s + Number(e.amount),
                  0,
                ) ?? 0;
              const hasExpenses = (renovation.expenses?.length ?? 0) > 0;
              const isExpanded = expanded.has(renovation.id);

              return (
                <div key={renovation.id}>
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 items-center px-1 py-1.5 hover:bg-muted/30 rounded transition-colors">
                    <button
                      type="button"
                      onClick={() => hasExpenses && toggle(renovation.id)}
                      className={`flex items-center justify-center w-5 h-5 text-muted-foreground ${hasExpenses ? "hover:text-foreground cursor-pointer" : "opacity-20 cursor-default"}`}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <Link
                      href={`/properties/${propertyId}/renovations/${renovation.id}`}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {renovation.name}
                    </Link>
                    <span className="text-sm font-medium tabular-nums whitespace-nowrap pl-6">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  {isExpanded && hasExpenses && (
                    <div className="divide-y bg-muted/20 rounded-b ml-6 mb-1">
                      {renovation.expenses!.map((expense) => (
                        <div
                          key={expense.id}
                          className="grid grid-cols-[1fr_auto] gap-x-4 items-center px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-muted-foreground truncate">
                              {expense.description ?? "Expense"}
                            </span>
                            {expense.supplier && (
                              <span className="text-xs text-muted-foreground/70 truncate hidden sm:block">
                                {expense.supplier}
                              </span>
                            )}
                            {expense.manual_classification && (
                              <ClassificationBadge
                                classification={expense.manual_classification}
                              />
                            )}
                          </div>
                          <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                            {formatCurrency(Number(expense.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {sectionTotal > 0 && (
            <div className="flex justify-between items-center px-1 pt-2 mt-1 border-t text-sm font-semibold">
              <span>Total spent</span>
              <span className="tabular-nums">{formatCurrency(sectionTotal)}</span>
            </div>
          )}
          </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function ClassificationBadge({ classification }: { classification: string }) {
  const colours =
    classification === "Capital Works"
      ? "bg-amber-100 text-amber-800"
      : classification === "Immediate Repair"
        ? "bg-purple-100 text-purple-800"
        : "bg-sky-100 text-sky-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${colours}`}
    >
      {classification}
    </span>
  );
}
