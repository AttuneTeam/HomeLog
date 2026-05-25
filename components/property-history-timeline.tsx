"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  Wrench,
  Wind,
  Square,
  Droplets,
  Building2,
  Layers,
  PaintBucket,
  Zap,
  Scale,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

export type RenovationExpense = {
  id: string;
  description: string | null;
  amount: number;
  category: string;
  supplier: string | null;
  abn: string | null;
  invoicePath: string | null;
  expenseDate: string;
  manualClassification: string | null;
};

export type TimelineEvent = {
  id: string;
  sortDate: string;
  displayDate: string | null;
  type: "purchase" | "renovation";
  title: string;
  subtitle: string | null;
  amount: number | null;
  renovation?: {
    id: string;
    contractor: string | null;
    classification: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    notes: string | null;
    expenses: RenovationExpense[];
  };
};

export type HistorySummary = {
  capitalInvested: number;
  renovationsCompleted: number;
  purchasePrice: number;
  purchaseYear: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  water: "Water",
  council_rates: "Council Rates",
  insurance: "Insurance",
  repairs_maintenance: "Repairs & Maintenance",
  strata_fees: "Strata Fees",
  land_tax: "Land Tax",
  other: "Other",
  labour: "Labour",
  materials: "Materials",
  permits: "Permits",
  professional_fees: "Professional Fees",
  appliances: "Appliances",
  fixtures: "Fixtures",
};

function iconForRenovation(title: string): LucideIcon {
  const t = title.toLowerCase();
  if (/plumb|storm|drain|water|pipe/.test(t)) return Droplets;
  if (/air|hvac|cool|climate|aircond/.test(t)) return Wind;
  if (/window|glass|leadlight/.test(t)) return Square;
  if (/floor|carpet/.test(t)) return Layers;
  if (/paint|render/.test(t)) return PaintBucket;
  if (/electric|solar|power/.test(t)) return Zap;
  if (/struct|foundation|slab|roof/.test(t)) return Building2;
  if (/sale|auction|purchase|market/.test(t)) return Scale;
  return Wrench;
}

function chapterLabel(index: number): string {
  return `Chapter ${String(index).padStart(2, "0")}`;
}

function shortMonthYear(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr)
    .toLocaleDateString("en-AU", { month: "short", year: "numeric" })
    .toUpperCase();
}

function InvoiceButton({
  invoicePath,
  bucket = "invoices",
}: {
  invoicePath: string;
  bucket?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(invoicePath, 3600);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 font-grotesk text-[11px] text-[#030813] hover:text-[#775a19] underline underline-offset-4 decoration-[#E2E2E2] transition-colors disabled:opacity-50"
    >
      <ExternalLink className="h-3 w-3" />
      {loading ? "Opening…" : "View invoice"}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<
    string,
    { bg: string; text: string; border: string; label: string }
  > = {
    completed: {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      label: "COMPLETED",
    },
    in_progress: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
      label: "IN PROGRESS",
    },
    planned: {
      bg: "bg-[#f5f3f3]",
      text: "text-[#45474c]",
      border: "border-[#E2E2E2]",
      label: "PLANNED",
    },
  };
  const c = configs[status] ?? configs.planned;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-grotesk text-[10px] tracking-[0.08em] font-semibold border ${c.bg} ${c.text} ${c.border}`}
    >
      {c.label}
    </span>
  );
}

function YearMarker({ year }: { year: number }) {
  return (
    <div className="flex items-center gap-4 py-2 pl-20 md:pl-28">
      <div className="h-px flex-1 bg-[#E2E2E2]" />
      <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c] shrink-0">
        {year}
      </span>
      <div className="h-px flex-1 bg-[#E2E2E2]" />
    </div>
  );
}

function EventAvatar({
  icon: Icon,
  variant = "default",
}: {
  icon: LucideIcon;
  variant?: "default" | "gold" | "blue";
}) {
  const variants: Record<string, string> = {
    default: "bg-[#e3e2e2] text-[#030813]",
    gold: "bg-[#fed488] text-[#775a19]",
    blue: "bg-[#dde2f3] text-[#030813]",
  };
  return (
    <div
      className={`w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center border-2 border-[#fff] relative z-10 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${variants[variant]}`}
    >
      <Icon className="w-6 h-6 md:w-8 md:h-8" />
    </div>
  );
}

function SummaryBar({ summary }: { summary: HistorySummary }) {
  return (
    <div className="bg-[#fbf9f9] border border-[#E2E2E2] rounded-lg overflow-hidden mb-12">
      <div className="px-6 md:px-8 py-3 border-b border-[#E2E2E2]">
        <p className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.1em] text-[#76777c]">
          Value Summary
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E2E2]">
        <div className="px-6 md:px-8 py-5">
          <p className="font-grotesk text-[11px] uppercase tracking-[0.1em] text-[#76777c] mb-2">
            Capital Invested
          </p>
          <p className="font-caslon text-[32px] leading-tight text-[#030813]">
            {summary.capitalInvested > 0
              ? formatCurrency(summary.capitalInvested)
              : "—"}
          </p>
          <p className="font-grotesk text-[12px] text-[#76777c] mt-1">
            in completed renovations
          </p>
        </div>
        <div className="px-6 md:px-8 py-5">
          <p className="font-grotesk text-[11px] uppercase tracking-[0.1em] text-[#76777c] mb-2">
            Renovations Completed
          </p>
          <p className="font-caslon text-[32px] leading-tight text-[#030813]">
            {summary.renovationsCompleted > 0
              ? summary.renovationsCompleted
              : "—"}
          </p>
          <p className="font-grotesk text-[12px] text-[#76777c] mt-1">
            improvements made
          </p>
        </div>
        <div className="px-6 md:px-8 py-5">
          <p className="font-grotesk text-[11px] uppercase tracking-[0.1em] text-[#76777c] mb-2">
            Purchase Price
          </p>
          <p className="font-caslon text-[32px] leading-tight text-[#030813]">
            {summary.purchasePrice > 0
              ? formatCurrency(summary.purchasePrice)
              : "—"}
          </p>
          {summary.purchaseYear && (
            <p className="font-grotesk text-[12px] text-[#76777c] mt-1">
              acquired in {summary.purchaseYear}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseCard({
  event,
  chapterIndex,
}: {
  event: TimelineEvent;
  chapterIndex: number;
}) {
  return (
    <div className="relative flex gap-8 md:gap-12 group">
      <EventAvatar icon={Scale} variant="blue" />
      <div className="pt-2 md:pt-4 bg-[#fbf9f9] p-6 md:p-8 rounded-lg border border-[#E2E2E2] flex-grow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-grotesk text-[11px] tracking-[0.1em] font-semibold uppercase text-[#76777c] mb-1 block">
              {chapterLabel(chapterIndex)}
            </span>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h3 className="font-caslon text-[24px] md:text-[32px] leading-tight text-[#030813]">
                {event.title}
              </h3>
              {event.displayDate && (
                <span className="bg-[#e3e2e2] text-[#45474c] font-grotesk text-[10px] tracking-[0.08em] font-semibold px-2 py-0.5 rounded border border-[#E2E2E2] uppercase">
                  {shortMonthYear(event.displayDate)}
                </span>
              )}
            </div>
            {event.subtitle && (
              <p className="font-grotesk text-[16px] text-[#45474c]">
                {event.subtitle}
              </p>
            )}
          </div>
          {event.amount != null && event.amount > 0 && (
            <div className="md:text-right border-t md:border-t-0 md:border-l border-[#E2E2E2] pt-4 md:pt-0 md:pl-8 flex-shrink-0">
              <p className="font-grotesk text-[11px] tracking-[0.1em] font-semibold uppercase text-[#76777c] mb-1">
                Purchase Price
              </p>
              <p className="font-caslon text-[24px] md:text-[32px] leading-tight text-[#030813]">
                {formatCurrency(event.amount)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RenovationCard({
  event,
  chapterIndex,
}: {
  event: TimelineEvent;
  chapterIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const reno = event.renovation!;
  const hasExpenses = reno.expenses.length > 0;
  const Icon = iconForRenovation(event.title);
  const avatarVariant = reno.status === "in_progress" ? "gold" : "default";

  return (
    <div className="relative flex gap-8 md:gap-12 group">
      <EventAvatar icon={Icon} variant={avatarVariant} />
      <div className="pt-2 md:pt-4 bg-[#fbf9f9] rounded-lg border border-[#E2E2E2] flex-grow overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="font-grotesk text-[11px] tracking-[0.1em] font-semibold uppercase text-[#76777c] mb-1 block">
                {chapterLabel(chapterIndex)}
              </span>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h3 className="font-caslon text-[24px] md:text-[32px] leading-tight text-[#030813]">
                  {event.title}
                </h3>
                <StatusBadge status={reno.status} />
                {event.displayDate && (
                  <span className="font-grotesk text-[10px] tracking-[0.08em] font-semibold px-2 py-0.5 rounded border border-[#E2E2E2] bg-[#f5f3f3] text-[#45474c] uppercase">
                    {shortMonthYear(event.displayDate)}
                  </span>
                )}
              </div>
              {(reno.description || reno.notes) && (
                <p className="font-grotesk text-[16px] text-[#45474c] mb-4 max-w-2xl leading-relaxed">
                  {reno.description ?? reno.notes}
                </p>
              )}
              {reno.contractor && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#E2E2E2]/50">
                  <span className="font-grotesk text-[11px] uppercase tracking-[0.08em] text-[#76777c]">
                    Contractor: {reno.contractor}
                  </span>
                </div>
              )}
            </div>
            {event.amount != null && event.amount > 0 && (
              <div className="md:text-right border-t md:border-t-0 md:border-l border-[#E2E2E2] pt-4 md:pt-0 md:pl-8 flex-shrink-0">
                <p className="font-grotesk text-[11px] tracking-[0.1em] font-semibold uppercase text-[#76777c] mb-1">
                  Value Invested
                </p>
                <p className="font-caslon text-[24px] md:text-[32px] leading-tight text-[#030813]">
                  {formatCurrency(event.amount)}
                </p>
              </div>
            )}
          </div>
        </div>

        {hasExpenses && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-6 md:px-8 py-3 border-t border-[#E2E2E2] font-grotesk text-[11px] font-semibold uppercase tracking-[0.08em] text-[#76777c] hover:bg-[#f5f3f3] transition-colors"
            >
              <span>
                {reno.expenses.length} expense
                {reno.expenses.length !== 1 ? "s" : ""} — breakdown
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {expanded && (
              <div className="border-t border-[#E2E2E2]">
                <div className="divide-y divide-[#E2E2E2]/50">
                  {reno.expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start justify-between gap-4 px-6 md:px-8 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-grotesk text-[14px] font-medium text-[#1b1c1c] truncate">
                          {e.description ??
                            CATEGORY_LABELS[e.category] ??
                            e.category}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {e.supplier && (
                            <span className="font-grotesk text-[12px] text-[#76777c]">
                              {e.supplier}
                            </span>
                          )}
                          {e.abn && (
                            <span className="font-grotesk text-[12px] text-[#76777c]">
                              ABN {e.abn}
                            </span>
                          )}
                          {e.manualClassification && (
                            <span className="px-1.5 py-0.5 rounded font-grotesk text-[11px] bg-[#ffdea5]/30 text-[#775a19]">
                              {e.manualClassification}
                            </span>
                          )}
                          {e.invoicePath && (
                            <InvoiceButton invoicePath={e.invoicePath} />
                          )}
                        </div>
                      </div>
                      <span className="font-grotesk text-[14px] font-semibold tabular-nums text-[#030813] shrink-0">
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center px-6 md:px-8 py-3 border-t border-[#E2E2E2] bg-[#f5f3f3]">
                  <span className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.08em] text-[#76777c]">
                    Total
                  </span>
                  <span className="font-grotesk text-[14px] font-bold tabular-nums text-[#030813]">
                    {formatCurrency(
                      reno.expenses.reduce((s, e) => s + e.amount, 0),
                    )}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  events: TimelineEvent[];
  summary: HistorySummary;
}

export function PropertyHistoryTimeline({ events, summary }: Props) {
  let lastYear: number | null = null;

  return (
    <div>
      <SummaryBar summary={summary} />

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E2E2] rounded-lg py-20 text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3f3]">
            <Wrench className="h-5 w-5 text-[#76777c]" />
          </div>
          <p className="font-grotesk font-semibold text-[#76777c]">
            No renovations recorded yet
          </p>
          <p className="font-grotesk text-[14px] text-[#76777c] max-w-xs">
            Add a renovation to start building your property&apos;s value story.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[31px] md:left-[47px] top-4 bottom-4 w-px bg-[#76777c]/20" />
          <div className="space-y-12">
            {events.map((event, i) => {
              const year = event.displayDate
                ? new Date(event.displayDate).getFullYear()
                : null;
              const showDivider = year !== null && year !== lastYear;
              if (year !== null) lastYear = year;

              return (
                <div key={event.id}>
                  {showDivider && year !== null && <YearMarker year={year} />}
                  {event.type === "purchase" ? (
                    <PurchaseCard event={event} chapterIndex={i + 1} />
                  ) : (
                    <RenovationCard event={event} chapterIndex={i + 1} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
