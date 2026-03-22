import { clsx, type ClassValue } from "clsx"
export type { ClassValue }
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function classificationLabel(c: "repair" | "capital_improvement" | "initial_repair"): string {
  if (c === "capital_improvement") return "Capital Improvement"
  if (c === "initial_repair") return "Initial Repair"
  return "Repair"
}

