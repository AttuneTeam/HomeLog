import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FinancialYearDividerRowProps {
  /** Financial-year label, e.g. "2025–26", or "Undated". */
  label: string;
  /**
   * How many records sit under this heading, already phrased for display —
   * "12 payments", "8 expenses".
   */
  count: string;
  /**
   * The year's money figures, right-aligned. A slot rather than a prop because
   * payments carry agent fees alongside the total and expenses do not.
   */
  figures: ReactNode;
  /** Columns the row must span, matching the table it sits in. */
  colSpan: number;
  className?: string;
}

/**
 * Subtotal heading marking where the financial year changes inside a table of
 * dated records.
 *
 * Rendered as a `th` with `scope="colgroup"` rather than a styled `td`, so a
 * screen reader announces the year as the heading for the rows beneath it
 * instead of reading a stray cell.
 *
 * Two details are load-bearing and easy to undo by accident:
 *
 * `position: sticky` sits on the `th`, not the `tr`. Sticky positioning on a
 * table row is not reliably supported across browsers, while a cell is.
 *
 * The hairlines are a box-shadow rather than a border. Tailwind's preflight
 * collapses table borders, and a collapsed border belongs to the table rather
 * than the cell, so it does not travel with the cell once it is stuck.
 *
 * The row pins to the top of the page while its own year's records scroll past.
 * That requires no ancestor between this cell and the viewport to be a scroll
 * container — `overflow-x: auto` alone is enough to create one, because the
 * other axis then computes to `auto` as well.
 *
 * The fill is the landing page's warm paper rather than `bg-background`, so the
 * heading reads as a distinct band instead of blending into the rows it
 * separates. That token is additive — the landing palette adds tokens rather
 * than redefining dashboard surfaces — and it carries a purpose-built dark
 * value, so it sits just below the page ground in light and just above it in
 * dark, staying legible either way. It must stay opaque, or rows show through
 * while scrolling.
 */
export function FinancialYearDividerRow({
  label,
  count,
  figures,
  colSpan,
  className,
}: FinancialYearDividerRowProps) {
  return (
    <tr>
      <th
        scope="colgroup"
        colSpan={colSpan}
        className={cn(
          "sticky top-0 z-10 bg-landing-warm px-1 py-2 text-left font-medium",
          "shadow-[0_1px_0_0_var(--border),0_-1px_0_0_var(--border)]",
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-x-3 gap-y-1 flex-wrap">
          <span className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm">{label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {count}
            </span>
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {figures}
          </span>
        </div>
      </th>
    </tr>
  );
}
