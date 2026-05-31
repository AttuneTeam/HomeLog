import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function ContractorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all contractors for this user with aggregated stats
  const { data: contractors } = await supabase
    .from("contractors")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  // For each contractor, fetch linked expense totals and last engaged date
  const contractorIds = (contractors ?? []).map((c) => c.id);

  type ExpenseRow = {
    contractor_id: string;
    amount: number;
    expense_date: string;
    renovations: { property_id: string } | null;
  };

  let expenseStats: Record<
    string,
    { total: number; lastDate: string; propertyIds: Set<string> }
  > = {};

  if (contractorIds.length > 0) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("contractor_id, amount, expense_date, renovations(property_id)")
      .in("contractor_id", contractorIds)
      .returns<ExpenseRow[]>();

    for (const e of expenses ?? []) {
      if (!e.contractor_id) continue;
      if (!expenseStats[e.contractor_id]) {
        expenseStats[e.contractor_id] = {
          total: 0,
          lastDate: e.expense_date,
          propertyIds: new Set(),
        };
      }
      expenseStats[e.contractor_id].total += Number(e.amount);
      if (e.expense_date > expenseStats[e.contractor_id].lastDate) {
        expenseStats[e.contractor_id].lastDate = e.expense_date;
      }
      const propId = e.renovations?.property_id;
      if (propId) expenseStats[e.contractor_id].propertyIds.add(propId);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#030813]">Contractors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All contractors and suppliers extracted from your invoices.
        </p>
      </div>

      {!contractors?.length ? (
        <div className="rounded-xl border-2 border-dashed border-[#E2E2E2] p-12 text-center space-y-2">
          <p className="font-grotesk text-[15px] font-semibold text-[#030813]">
            No contractors yet
          </p>
          <p className="font-grotesk text-[13px] text-[#76777c] max-w-sm mx-auto">
            Contractor records are built automatically when you upload invoices
            to renovation expenses.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E2E2] overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E2E2] bg-[#f9f9f9]">
                <th className="text-left px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c]">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c] hidden sm:table-cell">
                  ABN
                </th>
                <th className="text-left px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c] hidden md:table-cell">
                  Location
                </th>
                <th className="text-right px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c]">
                  Total billed
                </th>
                <th className="text-right px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c] hidden sm:table-cell">
                  Properties
                </th>
                <th className="text-right px-4 py-3 font-grotesk text-[11px] font-semibold uppercase tracking-wider text-[#76777c] hidden md:table-cell">
                  Last engaged
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E2E2]">
              {contractors.map((c) => {
                const stats = expenseStats[c.id];
                const location = [c.suburb, c.state].filter(Boolean).join(", ");
                const lastDate = stats?.lastDate
                  ? new Date(stats.lastDate).toLocaleDateString("en-AU", {
                      month: "short",
                      year: "numeric",
                    })
                  : "—";
                return (
                  <tr key={c.id} className="hover:bg-[#f9f9f9] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-grotesk text-[14px] font-medium text-[#030813]">
                        {c.name}
                      </p>
                      {c.trade_category && (
                        <p className="font-grotesk text-[11px] text-[#76777c]">
                          {c.trade_category}
                        </p>
                      )}
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-grotesk text-[11px] text-violet-600 hover:underline"
                        >
                          {c.website}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 font-grotesk text-[13px] text-[#76777c] hidden sm:table-cell">
                      {c.abn ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-grotesk text-[13px] text-[#76777c] hidden md:table-cell">
                      {location || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-grotesk text-[14px] font-medium text-[#030813]">
                      {stats ? formatCurrency(stats.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-grotesk text-[13px] text-[#76777c] hidden sm:table-cell">
                      {stats ? stats.propertyIds.size : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-grotesk text-[13px] text-[#76777c] hidden md:table-cell">
                      {lastDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
