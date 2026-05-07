import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/button-link";
import { formatCurrency, formatDate, classificationLabel } from "@/lib/utils";
import {
  Building2,
  Wrench,
  Receipt,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Fetch all data needed for the dashboard
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, suburb, state, purchase_price")
    .order("created_at", { ascending: false });

  // Fetch all renovations with expenses for aggregation
  const { data: renovations } = await supabase
    .from("renovations")
    .select(
      `
      id, name, status, classification, start_date, end_date, property_id,
      properties!inner(address, user_id),
      expenses(amount, manual_classification, expense_date)
    `,
    )
    .eq("properties.user_id", user.id)
    .order("created_at", { ascending: false });

  const propertyCount = properties?.length ?? 0;

  const allExpenses =
    renovations?.flatMap((r) =>
      (r.expenses ?? []).map(
        (e: {
          amount: number;
          manual_classification: string | null;
          expense_date: string;
        }) => ({
          ...e,
          renovation_classification: r.classification,
        }),
      ),
    ) ?? [];

  const totalSpend = allExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const repairTotal = allExpenses.reduce((s, e) => {
    const cls = e.manual_classification ?? e.renovation_classification;
    return cls === "Repair" ? s + Number(e.amount) : s;
  }, 0);

  const capitalTotal = allExpenses.reduce((s, e) => {
    const cls = e.manual_classification ?? e.renovation_classification;
    return cls === "Capital Works" ? s + Number(e.amount) : s;
  }, 0);

  const activeRenovations =
    renovations?.filter((r) => r.status === "in_progress") ?? [];
  const recentRenovations = renovations?.slice(0, 5) ?? [];

  // Category spend breakdown
  const { data: categoryData } = await supabase
    .from("expenses")
    .select(
      `
      category, amount,
      renovations!inner(
        property_id,
        properties!inner(user_id)
      )
    `,
    )
    .eq("renovations.properties.user_id", user.id);

  const categoryTotals: Record<string, number> = {};
  categoryData?.forEach((e) => {
    categoryTotals[e.category] =
      (categoryTotals[e.category] ?? 0) + Number(e.amount);
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const categoryLabels: Record<string, string> = {
    labour: "Labour",
    materials: "Materials",
    permits: "Permits",
    professional_fees: "Professional fees",
    appliances: "Appliances",
    fixtures: "Fixtures",
    other: "Other",
  };

  const statusColors: Record<string, string> = {
    planned: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  };
  const statusLabels: Record<string, string> = {
    planned: "Planned",
    in_progress: "In progress",
    completed: "Completed",
  };

  const displayName = profile?.display_name ?? user.email ?? "there";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {displayName.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Here&apos;s an overview of your property portfolio
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Properties
              </span>
            </div>
            <p className="text-3xl font-bold">{propertyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wrench className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Active
              </span>
            </div>
            <p className="text-3xl font-bold">{activeRenovations.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              renovations in progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Receipt className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total spend
              </span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Improvements
              </span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(capitalTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              added to cost base
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spend by classification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Spend by tax classification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalSpend === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expenses recorded yet.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                      Repairs
                    </span>
                    <span className="font-medium">
                      {formatCurrency(repairTotal)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{
                        width: `${totalSpend ? (repairTotal / totalSpend) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      Capital improvements
                    </span>
                    <span className="font-medium">
                      {formatCurrency(capitalTotal)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{
                        width: `${totalSpend ? (capitalTotal / totalSpend) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            <Link
              href="/financial"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
            >
              View full financial position <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Spend by category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expenses recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sortedCategories.map(([cat, amount]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {categoryLabels[cat] ?? cat}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity / renovation timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent renovations</h2>
          <ButtonLink href="/properties" variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add property
          </ButtonLink>
        </div>

        {recentRenovations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 text-center gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Nothing here yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a property and start tracking renovations
              </p>
            </div>
            <ButtonLink href="/properties/new" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add property
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRenovations.map((r) => {
              const rTotal = (r.expenses ?? []).reduce(
                (s: number, e: { amount: number }) => s + Number(e.amount),
                0,
              );
              const isCapital = r.classification === "capital_improvement";
              return (
                <Link
                  key={r.id}
                  href={`/properties/${r.property_id}/renovations/${r.id}`}
                >
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="py-3.5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{r.name}</span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status]}`}
                          >
                            {statusLabels[r.status]}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isCapital ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}
                          >
                            {r.classification === "capital_improvement"
                              ? "Capital Improvement"
                              : r.classification === "initial_repair"
                                ? "Initial Repair"
                                : "Repair"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {
                            (r.properties as unknown as { address: string })
                              ?.address
                          }
                          {r.start_date ? ` · ${formatDate(r.start_date)}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold text-sm shrink-0">
                        {formatCurrency(rTotal)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
