"use client";

import { useState, useTransition } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertPropertyFyFacts } from "@/app/actions/property-fy-facts";
import type { PropertyFyFacts } from "@/lib/supabase/database.types";

interface Props {
  propertyId: string;
  financialYearEnd: number;
  financialYearLabel: string;
  /** Null when nothing has been recorded for this year yet. */
  facts: PropertyFyFacts | null;
  /** Days in this financial year, used to describe the default. */
  daysInYear: number;
}

/**
 * Records ownership share and rental availability for one financial year.
 *
 * When nothing has been recorded the panel shows the assumptions the report
 * will fall back on — sole ownership, available all year — rather than
 * pre-filling the inputs. Pre-filling would make an assumption look like a
 * recorded fact, which is exactly the distinction the tax pack has to preserve.
 */
export function PropertyFyFactsPanel({
  propertyId,
  financialYearEnd,
  financialYearLabel,
  facts,
  daysInYear,
}: Props) {
  const [ownershipPct, setOwnershipPct] = useState(
    facts?.ownership_pct != null ? String(facts.ownership_pct) : "",
  );
  const [daysAvailable, setDaysAvailable] = useState(
    facts?.days_available_for_rent != null
      ? String(facts.days_available_for_rent)
      : "",
  );
  const [privateUseDays, setPrivateUseDays] = useState(
    facts?.private_use_days != null ? String(facts.private_use_days) : "",
  );
  const [isPending, startTransition] = useTransition();

  const isRecorded = facts != null;

  function handleSave() {
    const pct = ownershipPct.trim() === "" ? 100 : Number(ownershipPct);
    const available =
      daysAvailable.trim() === "" ? null : Number(daysAvailable);
    const priv = privateUseDays.trim() === "" ? null : Number(privateUseDays);

    if (Number.isNaN(pct) || Number.isNaN(available!) || Number.isNaN(priv!)) {
      toast.error("Please enter numbers only.");
      return;
    }

    startTransition(async () => {
      const { error } = await upsertPropertyFyFacts({
        propertyId,
        financialYearEnd,
        ownershipPct: pct,
        daysAvailableForRent: available,
        privateUseDays: priv,
        notes: null,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`Saved for ${financialYearLabel}.`);
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
              <strong>available to rent for all {daysInYear} days</strong>, and
              says so wherever those figures are used.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
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
            <Label htmlFor="days-available">Days available for rent</Label>
            <Input
              id="days-available"
              inputMode="numeric"
              placeholder={String(daysInYear)}
              value={daysAvailable}
              onChange={(e) => setDaysAvailable(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Genuinely available, not only tenanted.
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

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} size="sm">
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
