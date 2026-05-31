"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  XERO_CATEGORIES,
  CATEGORY_KEYWORDS,
  type HomeBaseCategory,
} from "@/lib/xero/categories";
import {
  saveXeroAccountMappings,
  type AccountMappingInput,
} from "@/app/actions/xero-account-mappings";
import type { XeroAccount, XeroTrackingCategory } from "@/lib/xero/client";
import type { XeroAccountMapping } from "@/lib/supabase/database.types";

interface Props {
  tenantId: string;
  existingMappings: XeroAccountMapping[];
}

const CATEGORY_GROUPS: { label: string; categories: HomeBaseCategory[] }[] = [
  {
    label: "Income",
    categories: ["rental_income"],
  },
  {
    label: "Rental Operating Expenses",
    categories: [
      "management_fees",
      "water",
      "council_rates",
      "insurance",
      "repairs_maintenance",
      "strata_fees",
      "land_tax",
      "other_rental_expense",
    ],
  },
  {
    label: "Renovation Expenses",
    categories: ["immediate_deduction", "initial_repair", "div43_capital_works", "div40_plant_equipment"],
  },
  {
    label: "Financing",
    categories: ["loan_interest"],
  },
  {
    label: "Journal Balancing",
    categories: ["clearing_account"],
  },
];

function suggestAccount(
  category: HomeBaseCategory,
  accounts: XeroAccount[],
): string {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  for (const kw of keywords) {
    const match = accounts.find((a) =>
      a.Name.toLowerCase().includes(kw.toLowerCase()),
    );
    if (match) return match.Code;
  }
  return "";
}

export function XeroAccountMappingPanel({ tenantId, existingMappings }: Props) {
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [trackingCategories, setTrackingCategories] = useState<XeroTrackingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<Record<HomeBaseCategory, string>>(() => {
    const initial: Partial<Record<HomeBaseCategory, string>> = {};
    for (const m of existingMappings) {
      initial[m.home_base_category as HomeBaseCategory] = m.xero_account_code;
    }
    return initial as Record<HomeBaseCategory, string>;
  });
  const [trackingCategoryId, setTrackingCategoryId] = useState<string>(
    existingMappings.find((m) => m.xero_tracking_category_id)
      ?.xero_tracking_category_id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [accountsRes, trackingRes] = await Promise.all([
          fetch(`/api/xero/accounts?tenantId=${encodeURIComponent(tenantId)}`),
          fetch(`/api/xero/tracking-categories?tenantId=${encodeURIComponent(tenantId)}`),
        ]);
        const accountsData = await accountsRes.json();
        const trackingData = await trackingRes.json();

        const fetchedAccounts: XeroAccount[] = accountsData.accounts ?? [];
        setAccounts(fetchedAccounts);
        setTrackingCategories(trackingData.categories ?? []);

        // Apply smart defaults for unmapped categories
        setMappings((prev) => {
          const updated = { ...prev };
          const allCategories = Object.keys(XERO_CATEGORIES) as HomeBaseCategory[];
          for (const cat of allCategories) {
            if (!updated[cat]) {
              const suggested = suggestAccount(cat, fetchedAccounts);
              if (suggested) updated[cat] = suggested;
            }
          }
          return updated;
        });
      } catch {
        toast.error("Failed to load Xero accounts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  function setMapping(category: HomeBaseCategory, code: string) {
    setMappings((prev) => ({ ...prev, [category]: code }));
  }

  function handleSave() {
    startTransition(async () => {
      const allCategories = Object.keys(XERO_CATEGORIES) as HomeBaseCategory[];
      const inputs: AccountMappingInput[] = allCategories
        .filter((cat) => mappings[cat])
        .map((cat) => ({
          home_base_category: cat,
          xero_account_code: mappings[cat],
          xero_account_name:
            accounts.find((a) => a.Code === mappings[cat])?.Name ?? null,
          xero_tracking_category_id: trackingCategoryId || null,
        }));

      try {
        await saveXeroAccountMappings(tenantId, inputs);
        toast.success("Account mappings saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save mappings");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account Mappings</CardTitle>
        <CardDescription className="text-xs">
          Map each Home Base category to a Xero account code. These are used when exporting to Xero.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading Xero accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-destructive">
            No active accounts found in this Xero organisation. Check your Xero chart of accounts.
          </p>
        ) : (
          <>
            {CATEGORY_GROUPS.map((group, i) => (
              <div key={group.label} className="space-y-3">
                {i > 0 && <Separator />}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.categories.map((cat) => (
                    <div key={cat} className="grid grid-cols-2 gap-3 items-center">
                      <span className="text-sm">{XERO_CATEGORIES[cat]}</span>
                      <Select
                        value={mappings[cat] ?? ""}
                        onValueChange={(v) => setMapping(cat, v ?? "")}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select account…" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acct) => (
                            <SelectItem key={acct.AccountID} value={acct.Code} className="text-xs">
                              {acct.Code} — {acct.Name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {trackingCategories.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Per-property tracking (optional)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Select a Xero tracking category to tag each property&apos;s journal lines, so
                    you can filter by property in Xero reports.
                  </p>
                  <Select
                    value={trackingCategoryId}
                    onValueChange={(v) => setTrackingCategoryId(v ?? "")}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No tracking category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">No tracking category</SelectItem>
                      {trackingCategories.map((tc) => (
                        <SelectItem
                          key={tc.TrackingCategoryID}
                          value={tc.TrackingCategoryID}
                          className="text-xs"
                        >
                          {tc.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Saving…" : "Save mappings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
