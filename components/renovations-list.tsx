"use client";

import { useState, Fragment } from "react";
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
    <table className="w-full text-sm">
      <tbody>
        {sections.map((status) => {
          const sectionTotal = byStatus[status].reduce(
            (s, r) =>
              s + (r.expenses?.reduce((a, e) => a + Number(e.amount), 0) ?? 0),
            0,
          );
          return (
            <Fragment key={status}>
              <tr>
                <td colSpan={3} className="px-1 pt-5 pb-2 first:pt-0">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {STATUS_LABELS[status]} ({byStatus[status].length})
                  </span>
                </td>
              </tr>
              {byStatus[status].map((renovation) => {
                const total =
                  renovation.expenses?.reduce(
                    (s, e) => s + Number(e.amount),
                    0,
                  ) ?? 0;
                const hasExpenses = (renovation.expenses?.length ?? 0) > 0;
                const isExpanded = expanded.has(renovation.id);
                return (
                  <Fragment key={renovation.id}>
                    <tr className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-1 py-1.5 w-7">
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
                      </td>
                      <td className="px-1 py-1.5">
                        <Link
                          href={`/properties/${propertyId}/renovations/${renovation.id}`}
                          className="font-medium hover:underline"
                        >
                          {renovation.name}
                        </Link>
                      </td>
                      <td className="px-1 py-1.5 text-right font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                    {isExpanded &&
                      hasExpenses &&
                      renovation.expenses!.map((expense) => (
                        <tr key={expense.id} className="border-t bg-muted/20">
                          <td className="py-1" />
                          <td className="px-1 py-1 pl-4">
                            <div className="space-y-1">
                              <span className="text-muted-foreground">
                                {expense.description ?? "Expense"}
                              </span>
                              {expense.supplier && (
                                <span className="text-xs text-muted-foreground/70 hidden sm:block">
                                  {expense.supplier}
                                </span>
                              )}
                              {expense.manual_classification && (
                                <ClassificationBadge
                                  classification={expense.manual_classification}
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-1 py-1 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            {formatCurrency(Number(expense.amount))}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              {sectionTotal > 0 && (
                <tr className="border-t">
                  <td colSpan={2} className="px-1 py-1.5 pb-8">
                    <span className="text-muted-foreground">Total</span>
                  </td>
                  <td className="px-1 py-1.5 text-right font-semibold tabular-nums">
                    {formatCurrency(sectionTotal)}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
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
