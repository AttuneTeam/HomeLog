"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarRange, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertPropertyFyFacts } from "@/app/actions/property-fy-facts";
import { daysAvailableInFy } from "@/lib/tax/fy";
import type { AvailabilitySuggestion } from "@/lib/tax/fy";
import type { PropertyFyFacts } from "@/lib/supabase/database.types";

/** Dates arrive as `yyyy-mm-dd`; parsed as UTC so the day never shifts. */
function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  propertyId: string;
  financialYearEnd: number;
  financialYearLabel: string;
  /** Null when nothing has been recorded for this year yet. */
  facts: PropertyFyFacts | null;
  /** Days in this financial year — 366 in a leap year. */
  daysInYear: number;
  /**
   * Days the property was held this year. Availability is measured against
   * this, not the whole year: a property bought part-way through incurs no
   * expenses before it is owned, so there is nothing to apportion away for the
   * earlier months.
   */
  daysOwnedInYear: number;
  /** Inclusive bounds of the year, as `yyyy-mm-dd`, used to bound the pickers. */
  fyStartDate: string;
  fyEndDate: string;
  fyStartMonth: number;
  fyStartDay: number;
  /**
   * Derived from tenancies already recorded for this property. A starting
   * point only — tenancy is a lower bound on availability.
   */
  suggestion: AvailabilitySuggestion | null;
}

/**
 * Records ownership share and rental availability for one financial year.
 *
 * Availability is captured as dates rather than a day count: the owner knows
 * when the property went on the market, not how many days that leaves in the
 * year. The count is derived and shown live so the figure is always checkable
 * against the fact it came from.
 *
 * When nothing has been recorded the panel states the assumptions the report
 * will fall back on rather than pre-filling the inputs with them — a
 * pre-filled assumption reads as a recorded fact, which is exactly the
 * distinction the tax pack has to preserve.
 */
export function PropertyFyFactsPanel({
  propertyId,
  financialYearEnd,
  financialYearLabel,
  facts,
  daysInYear,
  daysOwnedInYear,
  fyStartDate,
  fyEndDate,
  fyStartMonth,
  fyStartDay,
  suggestion,
}: Props) {
  const [ownershipPct, setOwnershipPct] = useState(
    facts?.ownership_pct != null ? String(facts.ownership_pct) : "",
  );
  const [availableFrom, setAvailableFrom] = useState(
    facts?.available_from ?? "",
  );
  const [availableTo, setAvailableTo] = useState(facts?.available_to ?? "");
  const [privateUseDays, setPrivateUseDays] = useState(
    facts?.private_use_days != null ? String(facts.private_use_days) : "",
  );
  const [isPending, startTransition] = useTransition();

  const isRecorded = facts != null;
  const hasDates = availableFrom !== "" || availableTo !== "";
  // Hide the suggestion once the inputs already hold it, so accepting it makes
  // the prompt disappear rather than lingering as an unfinished action.
  const matchesSuggestion =
    suggestion != null &&
    availableFrom === suggestion.from &&
    availableTo === suggestion.to;
  const invertedRange =
    availableFrom !== "" && availableTo !== "" && availableTo < availableFrom;

  // Mirrors what the Server Action will store, so the number on screen is the
  // number that gets saved.
  const derivedDays = useMemo(() => {
    if (!hasDates || invertedRange) return null;
    return daysAvailableInFy(
      financialYearEnd,
      availableFrom || null,
      availableTo || null,
      fyStartMonth,
      fyStartDay,
    );
  }, [
    hasDates,
    invertedRange,
    financialYearEnd,
    availableFrom,
    availableTo,
    fyStartMonth,
    fyStartDay,
  ]);

  function handleSave() {
    const pct = ownershipPct.trim() === "" ? 100 : Number(ownershipPct);
    const priv =
      privateUseDays.trim() === "" ? null : Number(privateUseDays);

    if (Number.isNaN(pct) || (priv != null && Number.isNaN(priv))) {
      toast.error("Please enter numbers only.");
      return;
    }
    if (invertedRange) {
      toast.error("The availability end date cannot be before the start date.");
      return;
    }

    startTransition(async () => {
      const { error, daysAvailable } = await upsertPropertyFyFacts({
        propertyId,
        financialYearEnd,
        ownershipPct: pct,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        daysAvailableForRent: null,
        privateUseDays: priv,
        notes: null,
        fyStartMonth,
        fyStartDay,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        daysAvailable != null
          ? `Saved — ${daysAvailable} days available in ${financialYearLabel}.`
          : `Saved for ${financialYearLabel}.`,
      );
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Ownership &amp; availability — {financialYearLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isRecorded && (
          <div className="flex gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Nothing recorded for this year. The report assumes{" "}
              <strong>sole ownership (100%)</strong> and that the property was{" "}
              <strong>
                available to rent for all {daysOwnedInYear} days you owned it
              </strong>
              , and
              says so wherever those figures are used.
            </p>
          </div>
        )}

        {suggestion && !matchesSuggestion && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-xs">
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground flex-1 min-w-[16rem]">
              From your {suggestion.tenancyCount} recorded{" "}
              {suggestion.tenancyCount === 1 ? "tenancy" : "tenancies"}:{" "}
              <strong className="text-foreground">
                {formatShortDate(suggestion.from)} –{" "}
                {formatShortDate(suggestion.to)}
              </strong>{" "}
              ({suggestion.days} days)
              {suggestion.bridgedDays > 0 && (
                <>
                  , including{" "}
                  <strong className="text-foreground">
                    {suggestion.bridgedDays} vacant days
                  </strong>{" "}
                  between tenancies — counted as available, since a property
                  between tenants is normally still on the market. Adjust if it
                  was withdrawn.
                </>
              )}
              . Tenancy is a lower bound: widen the dates if it was listed
              earlier.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAvailableFrom(suggestion.from);
                setAvailableTo(suggestion.to);
              }}
            >
              Use these dates
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ownership-pct">Your ownership share (%)</Label>
            <Input
              id="ownership-pct"
              inputMode="decimal"
              placeholder="100"
              value={ownershipPct}
              onChange={(e) => setOwnershipPct(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Apportions income and deductions.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="available-from">Available from</Label>
            <Input
              id="available-from"
              type="date"
              min={fyStartDate}
              max={fyEndDate}
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When it went on the market, not when a tenant moved in.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="available-to">Available until</Label>
            <Input
              id="available-to"
              type="date"
              min={fyStartDate}
              max={fyEndDate}
              value={availableTo}
              onChange={(e) => setAvailableTo(e.target.value)}
              aria-invalid={invertedRange}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if still available at year end.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="private-use-days">Private use days</Label>
            <Input
              id="private-use-days"
              inputMode="numeric"
              placeholder="0"
              value={privateUseDays}
              onChange={(e) => setPrivateUseDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Reduces deductions only — never income.
            </p>
          </div>
        </div>

        <div
          className="rounded-md bg-muted/50 px-3 py-2 text-sm"
          aria-live="polite"
        >
          {invertedRange ? (
            <span className="text-destructive">
              The end date is before the start date.
            </span>
          ) : derivedDays != null ? (
            <>
              <span className="font-medium tabular-nums">{derivedDays}</span>{" "}
              <span className="text-muted-foreground">
                of {daysOwnedInYear} days owned, available for rent in{" "}
                {financialYearLabel}
                {derivedDays === daysOwnedInYear
                  ? daysOwnedInYear === daysInYear
                    ? " (the whole year)"
                    : " (the whole time you owned it)"
                  : ""}
                .
                Calculated from the dates above.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              No availability dates set — the report treats the property as
              available for all {daysOwnedInYear} days you owned it.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending || invertedRange}
            size="sm"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save for {financialYearLabel}
          </Button>
          <p className="text-xs text-muted-foreground">
            Each financial year is recorded separately.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
