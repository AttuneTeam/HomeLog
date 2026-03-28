"use client";

import { useCallback, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { AlertTriangle, ChevronDown, Download, ExternalLink, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TaxExpense, TaxReportData } from "@/components/tax-report-pdf";
import { TaxReportDocument } from "@/components/tax-report-pdf";

export type { TaxExpense, TaxReportData };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sum(expenses: TaxExpense[]) {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

function categoryLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold border-b pb-2 mb-3">{children}</h2>
  );
}

function SummaryRow({
  label,
  value,
  sub,
  bold,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-baseline gap-4 py-1.5 ${bold ? "border-t mt-1 pt-2" : ""}`}
    >
      <span
        className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}
      >
        {label}
        {sub && (
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            {sub}
          </span>
        )}
      </span>
      <span className={`text-sm font-medium whitespace-nowrap ${bold ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ExpenseTable({ expenses }: { expenses: TaxExpense[] }) {
  if (expenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-3">
        No expenses in this category.
      </p>
    );
  }

  const total = sum(expenses);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
              Date
            </th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">
              Supplier
            </th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">
              ABN
            </th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">
              Category
            </th>
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">
              Description
            </th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
              Ex-GST
            </th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
              GST
            </th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
              Total
            </th>
            <th className="py-2 px-2 font-medium text-muted-foreground">
              Invoice
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => {
            const exGst =
              e.gst_amount != null ? e.amount - e.gst_amount : null;
            return (
              <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                  {formatDate(e.expense_date)}
                </td>
                <td className="py-2 px-2 font-medium">
                  {e.supplier ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 px-2 text-muted-foreground tabular-nums">
                  {e.abn ?? "—"}
                </td>
                <td className="py-2 px-2 text-muted-foreground">
                  {categoryLabel(e.category)}
                </td>
                <td className="py-2 px-2 text-muted-foreground max-w-[180px] truncate">
                  {e.description ?? e.renovation_name}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  {exGst != null ? formatCurrency(exGst) : "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  {e.gst_amount != null ? formatCurrency(e.gst_amount) : "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-medium">
                  {formatCurrency(e.amount)}
                </td>
                <td className="py-2 px-2 text-center">
                  {e.invoice_url ? (
                    <a
                      href={e.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted/50 font-semibold border-t">
            <td colSpan={7} className="py-2 px-2 text-sm">
              Subtotal
            </td>
            <td className="py-2 px-2 text-right text-sm tabular-nums">
              {formatCurrency(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TaxReport({ data }: { data: TaxReportData }) {
  const { property, roiInputs, repairs, initialRepairs, capitalImprovements, generatedAt } =
    data;

  const [downloading, setDownloading] = useState(false);
  const [xlsxDownloading, setXlsxDownloading] = useState(false);

  const purchasePrice = property.purchase_price ?? 0;
  const stampDuty = roiInputs?.stamp_duty ?? 0;
  const initialRepairTotal = sum(initialRepairs);
  const capitalTotal = sum(capitalImprovements);
  const costBase = purchasePrice + stampDuty + initialRepairTotal + capitalTotal;

  const div43 = roiInputs?.div43_depreciation ?? null;
  const div40 = roiInputs?.div40_depreciation ?? null;
  const weeklyRent = roiInputs?.weekly_rent ?? null;
  const annualRent = weeklyRent != null ? weeklyRent * 52 : null;

  const fullAddress = [
    property.address,
    property.suburb,
    property.state,
    property.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const handleExcelDownload = useCallback(() => {
    setXlsxDownloading(true);
    try {
      // Combine all expenses regardless of classification
      const all = [...repairs, ...initialRepairs, ...capitalImprovements];

      // Group by renovation_name, preserving first-seen order
      const groups = new Map<string, TaxExpense[]>();
      for (const e of all) {
        const key = e.renovation_name ?? "Unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }

      // Sort groups by completion date (latest expense date) ascending
      const sortedGroups = Array.from(groups.entries()).sort(([, a], [, b]) => {
        const maxA = a.reduce((m, e) => (e.expense_date > m ? e.expense_date : m), a[0].expense_date);
        const maxB = b.reduce((m, e) => (e.expense_date > m ? e.expense_date : m), b[0].expense_date);
        return maxA.localeCompare(maxB);
      });

      // Build AOA rows — one row per renovation group
      type Row = (string | number)[];
      const rows: Row[] = [["Completion Date", "Description", "Supplier", "Ex-GST", "GST", "Total"]];

      for (const [renovationName, expenses] of sortedGroups) {
        // Completion date = latest expense date in the group
        const maxDate = expenses.reduce(
          (m, e) => (e.expense_date > m ? e.expense_date : m),
          expenses[0].expense_date
        );

        // Description cell: renovation title + line break + renovation description
        const renovationDesc = expenses[0]?.renovation_description ?? null;
        const descriptionCell =
          renovationName + (renovationDesc ? "\n" + renovationDesc : "");

        // Supplier: first non-null value in the group
        const supplier = expenses.find((e) => e.supplier)?.supplier ?? "";

        // Sum amounts
        let sumExGst = 0;
        let sumGst = 0;
        let sumTotal = 0;
        for (const e of expenses) {
          const exGst = e.gst_amount != null ? e.amount - e.gst_amount : e.amount;
          sumExGst += exGst;
          sumGst += e.gst_amount ?? 0;
          sumTotal += e.amount;
        }

        rows.push([formatDate(maxDate), descriptionCell, supplier, sumExGst, sumGst, sumTotal]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Column widths
      ws["!cols"] = [
        { wch: 16 }, // Completion Date
        { wch: 40 }, // Description
        { wch: 22 }, // Supplier
        { wch: 12 }, // Ex-GST
        { wch: 10 }, // GST
        { wch: 12 }, // Total
      ];

      // Apply currency format and wrap text to data rows
      const currencyFmt = '"$"#,##0.00';
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let r = 1; r <= range.e.r; r++) {
        // Wrap text in Description column so multi-line content is visible
        const descRef = XLSX.utils.encode_cell({ r, c: 1 });
        if (ws[descRef]) {
          ws[descRef].s = { alignment: { wrapText: true, vertical: "top" } };
        }
        // Currency format for Ex-GST, GST, Total columns
        for (let c = 3; c <= 5; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (ws[cellRef] && typeof ws[cellRef].v === "number") {
            ws[cellRef].z = currencyFmt;
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");
      XLSX.writeFile(wb, `expenses-${property.address.replace(/\s+/g, "-").toLowerCase()}-${new Date().getFullYear()}.xlsx`, { cellStyles: true });
    } finally {
      setXlsxDownloading(false);
    }
  }, [repairs, initialRepairs, capitalImprovements, property.address]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await pdf(<TaxReportDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax-report-${property.address.replace(/\s+/g, "-").toLowerCase()}-${new Date().getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [data, property.address]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tax Report</h1>
          <p className="text-muted-foreground mt-1">{fullAddress}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated {generatedAt}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={downloading || xlsxDownloading}>
              <Download className="h-4 w-4 mr-1.5" />
              {downloading ? "Generating PDF…" : xlsxDownloading ? "Generating…" : "Download"}
              <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExcelDownload} disabled={xlsxDownloading}>
              <Sheet className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
              <FileText className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <strong>For accountant / tax agent use.</strong> This report
          summarises data entered in Home Base. It is not financial or tax
          advice. Rental income shown is an estimate from the ROI calculator.
          Depreciation figures require confirmation from a registered quantity
          surveyor. Always have a registered tax agent review before lodging.
        </p>
      </div>

      {/* Property & Income Summary */}
      <section>
        <SectionHeading>Property &amp; Income Summary</SectionHeading>
        <div className="divide-y">
          <SummaryRow label="Property address" value={fullAddress} />
          <SummaryRow
            label="Purchase date"
            value={formatDate(property.purchase_date)}
          />
          <SummaryRow
            label="Purchase price"
            value={formatCurrency(property.purchase_price)}
          />
          <SummaryRow
            label="Estimated annual rental income"
            value={
              annualRent != null
                ? `${formatCurrency(annualRent)}`
                : "Not entered"
            }
            sub={weeklyRent != null ? `(${formatCurrency(weeklyRent)}/wk — from ROI inputs)` : undefined}
          />
        </div>
      </section>

      {/* Repairs & Maintenance */}
      <section>
        <SectionHeading>
          Deductible Expenses — Repairs &amp; Maintenance
        </SectionHeading>
        <p className="text-xs text-muted-foreground mb-3">
          Immediately deductible in the year the expense was incurred (subject
          to income-producing use).
        </p>
        <ExpenseTable expenses={repairs} />
      </section>

      {/* Initial Repairs */}
      <section>
        <SectionHeading>Initial Repairs at Purchase</SectionHeading>
        <p className="text-xs text-muted-foreground mb-3">
          Repairs made to bring the property to a rentable condition at
          purchase. Not immediately deductible — added to the CGT cost base.
        </p>
        <ExpenseTable expenses={initialRepairs} />
      </section>

      {/* Capital Improvements */}
      <section>
        <SectionHeading>Capital Improvements</SectionHeading>
        <p className="text-xs text-muted-foreground mb-3">
          Improvements that add to or extend the property&apos;s value. Added
          to the CGT cost base; may attract Division 43 depreciation deductions.
        </p>
        <ExpenseTable expenses={capitalImprovements} />
      </section>

      {/* CGT Cost Base */}
      <section>
        <SectionHeading>CGT Cost Base Calculation</SectionHeading>
        <div className="divide-y max-w-sm">
          <SummaryRow
            label="Purchase price"
            value={formatCurrency(purchasePrice)}
          />
          <SummaryRow
            label="Stamp duty"
            sub="from ROI inputs"
            value={formatCurrency(stampDuty)}
          />
          <SummaryRow
            label={`Initial repairs (${initialRepairs.length} expense${initialRepairs.length !== 1 ? "s" : ""})`}
            value={formatCurrency(initialRepairTotal)}
          />
          <SummaryRow
            label={`Capital improvements (${capitalImprovements.length} expense${capitalImprovements.length !== 1 ? "s" : ""})`}
            value={formatCurrency(capitalTotal)}
          />
          <SummaryRow
            label="Total adjusted cost base"
            value={formatCurrency(costBase)}
            bold
          />
        </div>
      </section>

      {/* Depreciation */}
      {(div43 != null || div40 != null) && (
        <section>
          <SectionHeading>Depreciation Schedule</SectionHeading>
          <p className="text-xs text-muted-foreground mb-3">
            Figures entered in the ROI calculator. Confirm with a registered
            quantity surveyor for an ATO-compliant schedule.
          </p>
          <div className="divide-y max-w-sm">
            {div43 != null && (
              <SummaryRow
                label="Division 43 — Capital works (building)"
                value={`${formatCurrency(div43)} p.a.`}
              />
            )}
            {div40 != null && (
              <SummaryRow
                label="Division 40 — Plant &amp; equipment"
                value={`${formatCurrency(div40)} p.a.`}
              />
            )}
            {div43 != null && div40 != null && (
              <SummaryRow
                label="Total annual depreciation deduction"
                value={`${formatCurrency(div43 + div40)} p.a.`}
                bold
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
