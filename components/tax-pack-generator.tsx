"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { AlertTriangle, Download, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxPackDocument, type PackData } from "@/components/tax-pack-document";

export interface EvidenceItem {
  /** Name the file will have inside the bundle. */
  fileName: string;
  /** Short-lived signed URL. Fetched during generation, not linked. */
  signedUrl: string | null;
  propertyAddress: string;
  kind: string;
  description: string;
  date: string | null;
  amount: number | null;
  /** Which schedule line this document supports. */
  feedsLine: string;
}

interface Props {
  data: PackData;
  evidence: EvidenceItem[];
}

type Stage = "idle" | "pdf" | "workbook" | "evidence" | "zip" | "done";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  pdf: "Building the report…",
  workbook: "Building the workbook…",
  evidence: "Collecting evidence…",
  zip: "Packaging…",
  done: "Done",
};

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Assembles the tax pack in the browser and downloads it as a single ZIP.
 *
 * Evidence is fetched and embedded as real files rather than linked. Signed
 * storage URLs expire in an hour, so a pack full of links would be broken by
 * the time an accountant opened the email.
 *
 * Partial failure is reported, never fatal: a document that cannot be fetched
 * is listed in the manifest and on the cover as not included, and the rest of
 * the pack is still produced. A pack that is 95% complete with a stated gap is
 * useful; an error page is not.
 */
export function TaxPackGenerator({ data, evidence }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<string[]>([]);

  const busy = stage !== "idle" && stage !== "done";

  async function generate() {
    setFailures([]);
    const missing: string[] = [];

    try {
      // Evidence first, so anything that fails can be named on the cover.
      setStage("evidence");
      setProgress({ done: 0, total: evidence.length });
      const files: Array<{ name: string; blob: Blob }> = [];

      for (const [index, item] of evidence.entries()) {
        if (!item.signedUrl) {
          missing.push(`${item.description} (${item.propertyAddress})`);
        } else {
          try {
            const res = await fetch(item.signedUrl);
            if (!res.ok) throw new Error(String(res.status));
            files.push({ name: item.fileName, blob: await res.blob() });
          } catch {
            missing.push(`${item.description} (${item.propertyAddress})`);
          }
        }
        setProgress({ done: index + 1, total: evidence.length });
      }

      const omissions = [...data.omissions];
      if (missing.length > 0) {
        omissions.push(
          `${missing.length} supporting ${missing.length === 1 ? "document" : "documents"} could not be included: ${missing.join("; ")}`,
        );
      }
      const packData: PackData = { ...data, omissions };

      setStage("pdf");
      const pdfBlob = await pdf(
        <TaxPackDocument data={packData} />,
      ).toBlob();

      setStage("workbook");
      const workbook = buildWorkbook(packData);

      setStage("zip");
      const zip = new JSZip();
      const fyTag = data.financialYearLabel.replace("–", "-");
      zip.file(`tax-pack-${fyTag}.pdf`, pdfBlob);
      zip.file(
        `tax-pack-${fyTag}.xlsx`,
        XLSX.write(workbook, { bookType: "xlsx", type: "array" }),
      );

      const included = new Set(files.map((f) => f.name));
      const manifest = [
        [
          "file",
          "property",
          "type",
          "description",
          "date",
          "amount",
          "supports",
          "included",
        ].join(","),
        ...evidence.map((item) =>
          [
            item.fileName,
            item.propertyAddress,
            item.kind,
            item.description,
            item.date,
            item.amount,
            item.feedsLine,
            included.has(item.fileName) ? "yes" : "NOT INCLUDED",
          ]
            .map(csvCell)
            .join(","),
        ),
      ].join("\n");
      zip.file("evidence/manifest.csv", manifest);

      for (const file of files) {
        zip.file(`evidence/${file.name}`, file.blob);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tax-pack-${fyTag}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setFailures(missing);
      setStage("done");
      toast.success(
        missing.length > 0
          ? `Pack downloaded — ${missing.length} document(s) could not be included.`
          : "Tax pack downloaded.",
      );
    } catch (error) {
      setStage("idle");
      toast.error(
        error instanceof Error
          ? `Couldn't build the pack: ${error.message}`
          : "Couldn't build the pack.",
      );
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Tax pack — {data.financialYearLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          One ZIP containing the report as a PDF, the same figures as a
          spreadsheet, and every supporting document as a real file with a
          manifest. Send it to your accountant as-is.
        </p>

        <ul className="text-xs text-muted-foreground space-y-1">
          <li>
            • {data.properties.filter((p) => !p.excludedReason).length} rental
            schedule(s) plus a portfolio summary
          </li>
          <li>• Capital works register and CGT cost base per property</li>
          <li>
            • {evidence.length} supporting document
            {evidence.length === 1 ? "" : "s"}
          </li>
          <li>• Pre-filled tax agent questionnaire</li>
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-1.5" />
            )}
            {busy ? STAGE_LABEL[stage] : "Generate tax pack"}
          </Button>
          {busy && stage === "evidence" && progress.total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.done} / {progress.total} documents
            </span>
          )}
          {stage === "done" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              Downloaded
            </span>
          )}
        </div>

        {failures.length > 0 && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {failures.length} document
                {failures.length === 1 ? "" : "s"} could not be included
              </p>
              <p className="mt-1">
                They are listed in the pack&apos;s manifest and on its cover, so
                nothing is silently missing. {failures.join("; ")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** One sheet per property plus a summary, with numbers as numbers. */
function buildWorkbook(data: PackData): XLSX.WorkBook {
  const book = XLSX.utils.book_new();

  const summary: Array<Array<string | number | null>> = [
    ["Investment property tax pack"],
    ["Financial year", data.financialYearLabel],
    ["Prepared for", data.taxpayerName],
    ["Generated", data.generatedAt],
    [],
    ["Portfolio summary"],
    ["Gross rental income", data.portfolio.totalGrossRent],
    ...data.portfolio.deductionTotals.map((l) => [l.label, -l.amount]),
    ["Total deductions", -data.portfolio.totalDeductions],
    [
      data.portfolio.isLoss ? "Net rental loss" : "Net rental income",
      data.portfolio.netResult,
    ],
    [],
    ["Property", "Gross rent", "Deductions", "Net", "Income source"],
    ...data.properties
      .filter((p) => !p.excludedReason)
      .map((p) => [
        p.address,
        p.grossRent,
        -p.totalDeductions,
        p.netResult,
        p.incomeSource === "accrued" ? "Estimated (tenancy terms)" : "Recorded payments",
      ]),
  ];
  if (data.excluded.length > 0) {
    summary.push([], ["Excluded from rental reporting"]);
    for (const e of data.excluded) summary.push([e.address, e.reason]);
  }
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(summary),
    "Summary",
  );

  for (const property of data.properties.filter((p) => !p.excludedReason)) {
    const rows: Array<Array<string | number | null>> = [
      [property.address],
      ["Financial year", data.financialYearLabel],
      [],
      [
        "Gross rental income",
        property.grossRent,
        property.incomeSource === "accrued"
          ? "Estimated from tenancy terms"
          : "From recorded payments",
      ],
      ...property.deductions.map((l) => [l.label, -l.amount]),
      ["Total deductions", -property.totalDeductions],
      [property.isLoss ? "Net rental loss" : "Net rental income", property.netResult],
      [],
      [
        "Apportionment",
        `${property.apportionment.ownershipPct.toFixed(0)}% ownership`,
        `${property.apportionment.deductibleDayPct.toFixed(0)}% of year available (deductions only)`,
      ],
      [],
      ["CGT cost base"],
      ["Purchase price", property.costBase.purchasePrice],
      ["Stamp duty", property.costBase.stampDuty],
      ["Initial repairs at purchase", property.costBase.initialRepairs],
      ["Capital improvements", property.costBase.capitalImprovements],
      ["Total adjusted cost base", property.costBase.total],
    ];

    if (property.div43Items.length > 0) {
      rows.push(
        [],
        ["Capital works register (Division 43)"],
        ["Item", "Completed", "Cost", "Rate %", "This year", "Written down"],
        ...property.div43Items.map((item) => [
          item.description ?? "Capital works",
          item.startDate,
          item.amount,
          item.ratePct,
          item.claimThisYear,
          item.writtenDownValue,
        ]),
      );
    }

    // Sheet names are capped at 31 characters by the format.
    const name = property.address.slice(0, 31).replace(/[[\]:*?/\\]/g, "");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }

  const questions: Array<Array<string | null>> = [
    ["Tax agent questionnaire", data.financialYearLabel],
    [],
    ["Section", "Question", "Answer", "Status"],
  ];
  for (const section of data.questionnaire) {
    for (const item of section.items) {
      questions.push([section.title, item.question, item.answer, item.status]);
    }
  }
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(questions),
    "Questionnaire",
  );

  return book;
}
