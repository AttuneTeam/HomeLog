"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Home,
  Wrench,
  Users,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Receipt,
  Building2,
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
  type:
    | "purchase"
    | "renovation"
    | "rental_start"
    | "rental_end"
    | "maintenance"
    | "document"
    | "rate_change";
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
  rental?: {
    weeklyRent: number;
    managementCompany: string | null;
    agentName: string | null;
    endDate: string | null;
  };
  maintenance?: {
    category: string;
    supplier: string | null;
    abn: string | null;
    invoicePath: string | null;
  };
  document?: {
    storagePath: string;
  };
  rateChange?: {
    rate: number;
    notes: string | null;
  };
};

export type HistorySummary = {
  capitalInvested: number;
  maintenanceSpend: number;
  renovationsCompleted: number;
  rentalYears: number;
};

type FilterKey =
  | "all"
  | "renovations"
  | "rental"
  | "maintenance"
  | "financial"
  | "documents";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "renovations", label: "Renovations" },
  { key: "rental", label: "Rental" },
  { key: "maintenance", label: "Maintenance" },
  { key: "financial", label: "Financial" },
  { key: "documents", label: "Documents" },
];

const FILTER_TYPES: Record<FilterKey, TimelineEvent["type"][]> = {
  all: [
    "purchase",
    "renovation",
    "rental_start",
    "rental_end",
    "maintenance",
    "document",
    "rate_change",
  ],
  renovations: ["renovation"],
  rental: ["rental_start", "rental_end"],
  maintenance: ["maintenance"],
  financial: ["purchase", "rate_change"],
  documents: ["document"],
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

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });
}

type EventConfig = {
  dot: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  label: string;
};

function getEventConfig(type: TimelineEvent["type"]): EventConfig {
  switch (type) {
    case "purchase":
      return {
        dot: "bg-violet-500 border-violet-200",
        icon: Home,
        badge: "bg-violet-100 text-violet-800",
        label: "Purchase",
      };
    case "renovation":
      return {
        dot: "bg-blue-500 border-blue-200",
        icon: Wrench,
        badge: "bg-blue-100 text-blue-800",
        label: "Renovation",
      };
    case "rental_start":
      return {
        dot: "bg-emerald-500 border-emerald-200",
        icon: Users,
        badge: "bg-emerald-100 text-emerald-800",
        label: "Tenancy",
      };
    case "rental_end":
      return {
        dot: "bg-emerald-400 border-emerald-100",
        icon: Users,
        badge: "bg-emerald-50 text-emerald-700",
        label: "Tenancy",
      };
    case "maintenance":
      return {
        dot: "bg-amber-500 border-amber-200",
        icon: Receipt,
        badge: "bg-amber-100 text-amber-800",
        label: "Maintenance",
      };
    case "document":
      return {
        dot: "bg-slate-400 border-slate-200",
        icon: FileText,
        badge: "bg-slate-100 text-slate-700",
        label: "Document",
      };
    case "rate_change":
      return {
        dot: "bg-purple-500 border-purple-200",
        icon: TrendingUp,
        badge: "bg-purple-100 text-purple-800",
        label: "Loan",
      };
  }
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
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
    >
      <ExternalLink className="h-3 w-3" />
      {loading ? "Opening…" : "View invoice"}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-600";
  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "in_progress"
        ? Clock
        : Clock;
  const label =
    status === "completed"
      ? "Completed"
      : status === "in_progress"
        ? "In progress"
        : "Planned";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = getEventConfig(event.type);
  const Icon = config.icon;

  const hasDetail =
    event.renovation?.expenses.length ||
    event.rental ||
    event.maintenance?.abn ||
    event.maintenance?.invoicePath ||
    event.rateChange?.notes ||
    event.renovation?.description ||
    event.renovation?.notes;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 ${hasDetail ? "cursor-pointer hover:bg-muted/30 transition-colors" : "cursor-default"}`}
      >
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.badge}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm leading-tight">{event.title}</span>
            {event.renovation && (
              <StatusBadge status={event.renovation.status} />
            )}
          </div>
          {event.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {event.amount != null && event.amount > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(event.amount)}
            </span>
          )}
          {hasDetail ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : null}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
          {/* Renovation detail */}
          {event.renovation && (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {event.renovation.contractor && (
                  <>
                    <span className="text-muted-foreground">Contractor</span>
                    <span className="font-medium">{event.renovation.contractor}</span>
                  </>
                )}
                {event.renovation.startDate && (
                  <>
                    <span className="text-muted-foreground">Start date</span>
                    <span>{formatDate(event.renovation.startDate)}</span>
                  </>
                )}
                {event.renovation.endDate && (
                  <>
                    <span className="text-muted-foreground">Completion</span>
                    <span>{formatDate(event.renovation.endDate)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Classification</span>
                <span className="capitalize">
                  {event.renovation.classification.replace(/_/g, " ")}
                </span>
              </div>
              {event.renovation.description && (
                <p className="text-sm text-muted-foreground italic">
                  {event.renovation.description}
                </p>
              )}
              {event.renovation.expenses.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Expenses
                  </p>
                  <div className="divide-y rounded-lg border bg-background overflow-hidden">
                    {event.renovation.expenses.map((e) => (
                      <div key={e.id} className="px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {e.description ?? CATEGORY_LABELS[e.category] ?? e.category}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {e.supplier && (
                                <span className="text-xs text-muted-foreground">
                                  {e.supplier}
                                </span>
                              )}
                              {e.abn && (
                                <span className="text-xs text-muted-foreground">
                                  ABN {e.abn}
                                </span>
                              )}
                              {e.manualClassification && (
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700">
                                  {e.manualClassification}
                                </span>
                              )}
                              {e.invoicePath && (
                                <InvoiceButton invoicePath={e.invoicePath} />
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold tabular-nums shrink-0">
                            {formatCurrency(e.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {event.renovation.notes && (
                <p className="text-xs text-muted-foreground">{event.renovation.notes}</p>
              )}
            </>
          )}

          {/* Rental detail */}
          {event.rental && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Weekly rent</span>
              <span className="font-medium">{formatCurrency(event.rental.weeklyRent)}/wk</span>
              {event.rental.managementCompany && (
                <>
                  <span className="text-muted-foreground">Manager</span>
                  <span>{event.rental.managementCompany}</span>
                </>
              )}
              {event.rental.agentName && (
                <>
                  <span className="text-muted-foreground">Agent</span>
                  <span>{event.rental.agentName}</span>
                </>
              )}
              {event.rental.endDate && (
                <>
                  <span className="text-muted-foreground">Ended</span>
                  <span>{formatDate(event.rental.endDate)}</span>
                </>
              )}
            </div>
          )}

          {/* Maintenance detail */}
          {event.maintenance && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Category</span>
                <span>{CATEGORY_LABELS[event.maintenance.category] ?? event.maintenance.category}</span>
                {event.maintenance.supplier && (
                  <>
                    <span className="text-muted-foreground">Supplier</span>
                    <span>{event.maintenance.supplier}</span>
                  </>
                )}
                {event.maintenance.abn && (
                  <>
                    <span className="text-muted-foreground">ABN</span>
                    <span>{event.maintenance.abn}</span>
                  </>
                )}
              </div>
              {event.maintenance.invoicePath && (
                <InvoiceButton invoicePath={event.maintenance.invoicePath} />
              )}
            </div>
          )}

          {/* Rate change detail */}
          {event.rateChange?.notes && (
            <p className="text-sm text-muted-foreground">{event.rateChange.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  events: TimelineEvent[];
  summary: HistorySummary;
}

export function PropertyHistoryTimeline({ events, summary }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [newestFirst, setNewestFirst] = useState(true);

  const visibleTypes = FILTER_TYPES[filter];
  const filtered = events.filter((e) => visibleTypes.includes(e.type));
  const sorted = newestFirst ? filtered : [...filtered].reverse();

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Capital invested
          </p>
          <p className="font-semibold mt-1 tabular-nums">
            {formatCurrency(summary.capitalInvested)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Maintenance spend
          </p>
          <p className="font-semibold mt-1 tabular-nums">
            {formatCurrency(summary.maintenanceSpend)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Renovations done
          </p>
          <p className="font-semibold mt-1">{summary.renovationsCompleted}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Rental history
          </p>
          <p className="font-semibold mt-1">
            {summary.rentalYears > 0 ? `${summary.rentalYears} yr${summary.rentalYears !== 1 ? "s" : ""}` : "—"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === opt.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {newestFirst ? "Newest first" : "Oldest first"} ↕
        </button>
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center gap-2">
          <p className="font-medium text-muted-foreground">No events found</p>
          <p className="text-sm text-muted-foreground">Try a different filter</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical axis line */}
          <div className="absolute left-[5.5rem] top-3 bottom-3 w-px bg-border hidden sm:block" />

          <div className="space-y-4">
            {sorted.map((event) => {
              const config = getEventConfig(event.type);
              return (
                <div key={event.id} className="flex gap-0 items-start">
                  {/* Date column — hidden on mobile */}
                  <div className="hidden sm:flex w-24 justify-end pr-4 pt-2.5 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {shortDate(event.displayDate)}
                    </span>
                  </div>

                  {/* Dot on axis */}
                  <div className="hidden sm:flex flex-col items-center shrink-0 w-4">
                    <div
                      className={`mt-2 h-3 w-3 rounded-full border-2 ${config.dot}`}
                    />
                  </div>

                  {/* Card */}
                  <div className="flex-1 sm:ml-4 min-w-0">
                    {/* Mobile date */}
                    <p className="sm:hidden text-xs text-muted-foreground mb-1">
                      {shortDate(event.displayDate)}
                    </p>
                    <EventCard event={event} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
