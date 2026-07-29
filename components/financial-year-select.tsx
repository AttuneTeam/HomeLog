"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FinancialYearOption {
  /** Calendar year the financial year ends in, e.g. 2026 for 2025–26. */
  fyEndYear: number;
  label: string;
}

interface Props {
  options: FinancialYearOption[];
  selected: number;
  /** Query parameter carrying the selection. Defaults to "fy". */
  paramName?: string;
}

/**
 * Financial-year picker that writes the selection to the URL, so a report is
 * linkable, reloadable and shareable rather than depending on component state.
 */
export function FinancialYearSelect({
  options,
  selected,
  paramName = "fy",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const labelFor = (value: string) =>
    options.find((o) => String(o.fyEndYear) === value)?.label ?? value;

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="financial-year"
        className="text-sm text-muted-foreground whitespace-nowrap"
      >
        Financial year
      </label>
      <Select
        value={String(selected)}
        onValueChange={(value) => {
          if (!value || value === String(selected)) return;
          startTransition(() => {
            router.push(`${pathname}?${paramName}=${value}`);
          });
        }}
      >
        <SelectTrigger id="financial-year" className="w-[150px]">
          <SelectValue>{(value) => labelFor(String(value))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.fyEndYear}
              value={String(option.fyEndYear)}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <Loader2
          className="h-4 w-4 animate-spin text-muted-foreground"
          aria-label="Loading report"
        />
      )}
    </div>
  );
}
