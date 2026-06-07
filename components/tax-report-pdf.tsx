"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { RentalExpenseCategory } from "@/lib/supabase/database.types";

// ─── Shared types (also imported by tax-report.tsx) ─────────────────────────

export interface TaxRentalExpense {
  id: string;
  expense_date: string;
  category: RentalExpenseCategory;
  amount: number;
  gst_amount: number | null;
  supplier: string | null;
  abn: string | null;
  description: string | null;
  invoice_url: string | null;
}

export interface TaxExpense {
  id: string;
  expense_date: string;
  supplier: string | null;
  abn: string | null;
  category: string;
  amount: number;
  gst_amount: number | null;
  description: string | null;
  classification: string;
  invoice_url: string | null;
  renovation_name: string;
  renovation_description: string | null;
}

export interface TaxReportData {
  property: {
    address: string;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    stamp_duty: number | null;
    purchase_date: string | null;
    purchase_price: number | null;
  };
  roiInputs: {
    stamp_duty: number | null;
    weekly_rent: number | null;
    div43_depreciation: number | null;
    div40_depreciation: number | null;
  } | null;
  repairs: TaxExpense[];
  initialRepairs: TaxExpense[];
  capitalImprovements: TaxExpense[];
  rentalExpenses: TaxRentalExpense[];
  financialYear: string;
  totalRentalIncome: number | null;
  totalAgentFees: number;
  totalOperatingExpenses: number;
  netRentalIncome: number | null;
  generatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function sum(expenses: TaxExpense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
  },
  reportTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  reportSubtitle: { fontSize: 10, color: "#555555", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerMeta: { fontSize: 8, color: "#555555", marginTop: 2 },
  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
  },
  // Summary rows
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLabel: { color: "#555555" },
  summaryValue: { fontFamily: "Helvetica-Bold" },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  summaryTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  summaryTotalValue: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  // Tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tableSubtotalRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
  },
  thTxt: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  tdTxt: { fontSize: 8 },
  tdMuted: { fontSize: 8, color: "#555555" },
  tdBold: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Column widths
  colDate: { width: "10%" },
  colSupplier: { width: "18%" },
  colAbn: { width: "13%" },
  colCategory: { width: "12%" },
  colDesc: { width: "20%" },
  colAmount: { width: "10%", textAlign: "right" },
  colGst: { width: "9%", textAlign: "right" },
  colExGst: { width: "8%", textAlign: "right" },
  // Disclaimer
  disclaimer: {
    marginTop: 24,
    padding: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  disclaimerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginBottom: 3,
    color: "#92400e",
  },
  disclaimerText: { fontSize: 7.5, color: "#92400e", lineHeight: 1.5 },
  // Empty state
  emptyRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  emptyTxt: { fontSize: 8, color: "#999999", fontStyle: "italic" },
  // Footer
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 48,
    fontSize: 8,
    color: "#999999",
  },
  footerLine: {
    position: "absolute",
    bottom: 40,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
  },
});

// ─── Table component ─────────────────────────────────────────────────────────

function ExpenseTable({ expenses }: { expenses: TaxExpense[] }) {
  return (
    <View>
      <View style={S.tableHeader}>
        <Text style={[S.thTxt, S.colDate]}>Date</Text>
        <Text style={[S.thTxt, S.colSupplier]}>Supplier</Text>
        <Text style={[S.thTxt, S.colAbn]}>ABN</Text>
        <Text style={[S.thTxt, S.colCategory]}>Category</Text>
        <Text style={[S.thTxt, S.colDesc]}>Description</Text>
        <Text style={[S.thTxt, S.colExGst, { textAlign: "right" }]}>
          Ex-GST
        </Text>
        <Text style={[S.thTxt, S.colGst, { textAlign: "right" }]}>GST</Text>
        <Text style={[S.thTxt, S.colAmount, { textAlign: "right" }]}>
          Total
        </Text>
      </View>

      {expenses.length === 0 ? (
        <View style={S.emptyRow}>
          <Text style={S.emptyTxt}>No expenses in this category.</Text>
        </View>
      ) : (
        expenses.map((e, i) => {
          const exGst = e.gst_amount != null ? e.amount - e.gst_amount : null;
          return (
            <View key={e.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tdTxt, S.colDate]}>
                {fmtDate(e.expense_date)}
              </Text>
              <Text style={[S.tdTxt, S.colSupplier]}>{e.supplier ?? "—"}</Text>
              <Text style={[S.tdMuted, S.colAbn]}>{e.abn ?? "—"}</Text>
              <Text style={[S.tdTxt, S.colCategory]}>
                {e.category.replace(/_/g, " ")}
              </Text>
              <Text style={[S.tdMuted, S.colDesc]}>
                {e.description ?? e.renovation_name}
              </Text>
              <Text style={[S.tdTxt, S.colExGst, { textAlign: "right" }]}>
                {exGst != null ? fmt(exGst) : "—"}
              </Text>
              <Text style={[S.tdTxt, S.colGst, { textAlign: "right" }]}>
                {e.gst_amount != null ? fmt(e.gst_amount) : "—"}
              </Text>
              <Text style={[S.tdBold, S.colAmount, { textAlign: "right" }]}>
                {fmt(e.amount)}
              </Text>
            </View>
          );
        })
      )}

      {expenses.length > 0 && (
        <View style={S.tableSubtotalRow}>
          <Text style={[S.thTxt, { flex: 1 }]}>Subtotal</Text>
          <Text style={[S.thTxt, S.colAmount, { textAlign: "right" }]}>
            {fmt(sum(expenses))}
          </Text>
        </View>
      )}
    </View>
  );
}

function rentalCategoryLabel(cat: RentalExpenseCategory): string {
  const MAP: Record<RentalExpenseCategory, string> = {
    water: "Water",
    council_rates: "Council Rates",
    insurance: "Insurance",
    repairs_maintenance: "Repairs & Maintenance",
    strata_fees: "Strata Fees",
    land_tax: "Land Tax",
    other: "Other",
  };
  return MAP[cat] ?? cat;
}

function RentalExpenseTable({ expenses }: { expenses: TaxRentalExpense[] }) {
  return (
    <View>
      <View style={S.tableHeader}>
        <Text style={[S.thTxt, S.colDate]}>Date</Text>
        <Text style={[S.thTxt, S.colCategory]}>Category</Text>
        <Text style={[S.thTxt, S.colSupplier]}>Supplier</Text>
        <Text style={[S.thTxt, S.colAbn]}>ABN</Text>
        <Text style={[S.thTxt, S.colDesc]}>Description</Text>
        <Text style={[S.thTxt, S.colExGst, { textAlign: "right" }]}>
          Ex-GST
        </Text>
        <Text style={[S.thTxt, S.colGst, { textAlign: "right" }]}>GST</Text>
        <Text style={[S.thTxt, S.colAmount, { textAlign: "right" }]}>
          Total
        </Text>
      </View>

      {expenses.length === 0 ? (
        <View style={S.emptyRow}>
          <Text style={S.emptyTxt}>No rental operating expenses recorded.</Text>
        </View>
      ) : (
        expenses.map((e, i) => {
          const exGst = e.gst_amount != null ? e.amount - e.gst_amount : null;
          return (
            <View key={e.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tdTxt, S.colDate]}>
                {fmtDate(e.expense_date)}
              </Text>
              <Text style={[S.tdTxt, S.colCategory]}>
                {rentalCategoryLabel(e.category)}
              </Text>
              <Text style={[S.tdTxt, S.colSupplier]}>{e.supplier ?? "—"}</Text>
              <Text style={[S.tdMuted, S.colAbn]}>{e.abn ?? "—"}</Text>
              <Text style={[S.tdMuted, S.colDesc]}>{e.description ?? "—"}</Text>
              <Text style={[S.tdTxt, S.colExGst, { textAlign: "right" }]}>
                {exGst != null ? fmt(exGst) : "—"}
              </Text>
              <Text style={[S.tdTxt, S.colGst, { textAlign: "right" }]}>
                {e.gst_amount != null ? fmt(e.gst_amount) : "—"}
              </Text>
              <Text style={[S.tdBold, S.colAmount, { textAlign: "right" }]}>
                {fmt(e.amount)}
              </Text>
            </View>
          );
        })
      )}

      {expenses.length > 0 && (
        <View style={S.tableSubtotalRow}>
          <Text style={[S.thTxt, { flex: 1 }]}>Subtotal</Text>
          <Text style={[S.thTxt, S.colAmount, { textAlign: "right" }]}>
            {fmt(expenses.reduce((s, e) => s + e.amount, 0))}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── PDF Document ────────────────────────────────────────────────────────────

export function TaxReportDocument({ data }: { data: TaxReportData }) {
  const {
    property,
    roiInputs,
    repairs,
    initialRepairs,
    capitalImprovements,
    rentalExpenses,
    financialYear,
    totalRentalIncome,
    totalAgentFees,
    totalOperatingExpenses,
    netRentalIncome,
    generatedAt,
  } = data;

  const purchasePrice = property.purchase_price ?? 0;
  const stampDuty = roiInputs?.stamp_duty ?? 0;
  const initialRepairTotal = sum(initialRepairs);
  const capitalTotal = sum(capitalImprovements);
  const costBase =
    purchasePrice + stampDuty + initialRepairTotal + capitalTotal;

  const div43 = roiInputs?.div43_depreciation ?? null;
  const div40 = roiInputs?.div40_depreciation ?? null;

  const fullAddress = [
    property.address,
    property.suburb,
    property.state,
    property.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const weeklyRent = roiInputs?.weekly_rent ?? null;
  const annualRent = weeklyRent != null ? weeklyRent * 52 : null;

  return (
    <Document
      title={`Tax Report — ${property.address}`}
      author="Home Base"
      subject="Investment Property Tax Report"
    >
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.reportTitle}>Investment Property Tax Report</Text>
            <Text style={S.reportSubtitle}>
              FY{financialYear} — {fullAddress}
            </Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerMeta}>Generated: {generatedAt}</Text>
            {property.purchase_date && (
              <Text style={S.headerMeta}>
                Owned since: {fmtDate(property.purchase_date)}
              </Text>
            )}
            <Text style={S.headerMeta}>
              Prepared by Home Base — For accountant use
            </Text>
          </View>
        </View>

        {/* Property & Income Summary */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Property &amp; Income Summary</Text>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Property address</Text>
            <Text style={S.summaryValue}>{fullAddress}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Purchase date</Text>
            <Text style={S.summaryValue}>
              {fmtDate(property.purchase_date)}
            </Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Purchase price</Text>
            <Text style={S.summaryValue}>{fmt(property.purchase_price)}</Text>
          </View>
          {totalRentalIncome != null && (
            <>
              <View style={S.summaryRow}>
                <Text style={S.summaryLabel}>Gross rental income</Text>
                <Text style={S.summaryValue}>{fmt(totalRentalIncome)}</Text>
              </View>
              {totalAgentFees > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLabel}>
                    Less: Agent management fees
                  </Text>
                  <Text style={S.summaryValue}>({fmt(totalAgentFees)})</Text>
                </View>
              )}
              {totalOperatingExpenses > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLabel}>Less: Operating expenses</Text>
                  <Text style={S.summaryValue}>
                    ({fmt(totalOperatingExpenses)})
                  </Text>
                </View>
              )}
              {netRentalIncome != null && (
                <View style={S.summaryTotalRow}>
                  <Text style={S.summaryTotalLabel}>Net rental income</Text>
                  <Text style={S.summaryTotalValue}>
                    {fmt(netRentalIncome)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Rental Operating Expenses */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>
            Operating Expenses (Immediately deductible — water, council rates,
            insurance, etc.)
          </Text>
          <RentalExpenseTable expenses={rentalExpenses} />
        </View>

        {/* Repairs & Maintenance */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>
            Deductible Expenses — Repairs &amp; Maintenance (Immediate
            deduction)
          </Text>
          <ExpenseTable expenses={repairs} />
        </View>

        {/* Initial Repairs */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>
            Initial Repairs at Purchase (Part of CGT cost base — not immediately
            deductible)
          </Text>
          <ExpenseTable expenses={initialRepairs} />
        </View>

        {/* Capital Improvements */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>
            Capital Improvements (Adds to CGT cost base — may attract Div 43
            depreciation)
          </Text>
          <ExpenseTable expenses={capitalImprovements} />
        </View>

        {/* CGT Cost Base */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>CGT Cost Base Calculation</Text>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Purchase price</Text>
            <Text style={S.summaryValue}>{fmt(purchasePrice)}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Stamp duty (from ROI inputs)</Text>
            <Text style={S.summaryValue}>{fmt(stampDuty)}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>
              Initial repairs at purchase ({initialRepairs.length} expense
              {initialRepairs.length !== 1 ? "s" : ""})
            </Text>
            <Text style={S.summaryValue}>{fmt(initialRepairTotal)}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>
              Capital improvements ({capitalImprovements.length} expense
              {capitalImprovements.length !== 1 ? "s" : ""})
            </Text>
            <Text style={S.summaryValue}>{fmt(capitalTotal)}</Text>
          </View>
          <View style={S.summaryTotalRow}>
            <Text style={S.summaryTotalLabel}>Total adjusted cost base</Text>
            <Text style={S.summaryTotalValue}>{fmt(costBase)}</Text>
          </View>
        </View>

        {/* Depreciation */}
        {(div43 != null || div40 != null) && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>
              Depreciation Schedule (from ROI inputs — confirm with quantity
              surveyor)
            </Text>
            {div43 != null && (
              <View style={S.summaryRow}>
                <Text style={S.summaryLabel}>
                  Division 43 — Capital works (building)
                </Text>
                <Text style={S.summaryValue}>{fmt(div43)} p.a.</Text>
              </View>
            )}
            {div40 != null && (
              <View style={S.summaryRow}>
                <Text style={S.summaryLabel}>
                  Division 40 — Plant &amp; equipment
                </Text>
                <Text style={S.summaryValue}>{fmt(div40)} p.a.</Text>
              </View>
            )}
            {div43 != null && div40 != null && (
              <View style={S.summaryTotalRow}>
                <Text style={S.summaryTotalLabel}>
                  Total annual depreciation deduction
                </Text>
                <Text style={S.summaryTotalValue}>
                  {fmt((div43 ?? 0) + (div40 ?? 0))}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Disclaimer */}
        <View style={S.disclaimer}>
          <Text style={S.disclaimerTitle}>Important Disclaimer</Text>
          <Text style={S.disclaimerText}>
            This report is a summary of data entered into Home Base and is
            provided for information purposes only. It does not constitute
            financial, tax, or legal advice. The rental income figure is an
            estimate based on weekly rent entered in the ROI calculator and may
            not reflect actual received income. Depreciation figures are entered
            estimates only — consult a registered quantity surveyor for an
            ATO-compliant depreciation schedule. CGT calculations are indicative
            and do not account for the 50% CGT discount, HECS/HELP obligations,
            or other personal deductions. Always consult a registered tax agent
            or financial adviser before lodging your tax return.
          </Text>
        </View>

        {/* Page number */}
        <View style={S.footerLine} fixed />
        <Text
          style={S.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
