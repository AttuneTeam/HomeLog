import { clsx, type ClassValue } from "clsx";
export type { ClassValue };
import { twMerge } from "tailwind-merge";
import { ManualTaxClassification } from "./supabase/database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function classificationLabel(c: ManualTaxClassification): string {
  if (c === "Capital Works") return "Capital Works";
  return c;
}

export function calcTotalSpend(
  renovations: Array<{
    status: string;
    expenses?: Array<{ amount: number | string }> | null;
  }>,
): number {
  return renovations.reduce((sum, r) => {
    if (r.status === "planned") return sum;
    return sum + (r.expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0);
  }, 0);
}
