"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  confirmLoanStatement,
  deleteLoanStatement,
} from "@/app/actions/loan-statements";
import type { LoanStatement } from "@/lib/supabase/database.types";
import type { LoanInterestEstimate } from "@/lib/tax/loan-interest";

interface Props {
  propertyId: string;
  financialYearEnd: number;
  financialYearLabel: string;
  statements: LoanStatement[];
  /**
   * Interest computed from the loan terms. Shown only when no statement has
   * been uploaded, and never counted as claimable.
   */
  estimate: LoanInterestEstimate | null;
}

function StatementRow({
  statement,
  propertyId,
  onChanged,
}: {
  statement: LoanStatement;
  propertyId: string;
  onChanged: () => void;
}) {
  const confirmed = statement.confirmed_at != null;
  const [interest, setInterest] = useState(
    statement.interest_paid != null ? String(statement.interest_paid) : "",
  );
  const [lender, setLender] = useState(statement.lender ?? "");
  const [accountRef, setAccountRef] = useState(statement.account_ref ?? "");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const extractedNotes =
    (statement.extracted as { notes?: string | null } | null)?.notes ?? null;
  const extractionFailed =
    (statement.extracted as { error?: string } | null)?.error != null;
  const originalInterest = (
    statement.extracted as { interest_paid?: number | null } | null
  )?.interest_paid;
  const edited =
    originalInterest != null &&
    interest !== "" &&
    Number(interest) !== Number(originalInterest);

  function handleConfirm() {
    const amount = Number(interest);
    if (interest.trim() === "" || Number.isNaN(amount)) {
      toast.error("Enter the interest paid before confirming.");
      return;
    }
    startTransition(async () => {
      const { error } = await confirmLoanStatement({
        id: statement.id,
        propertyId,
        interestPaid: amount,
        lender: lender.trim() || null,
        accountRef: accountRef.trim() || null,
        periodStart: statement.period_start,
        periodEnd: statement.period_end,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Interest confirmed and included in the report.");
      onChanged();
    });
  }

  function handleDelete() {
    startDeleting(async () => {
      const { error } = await deleteLoanStatement(statement.id, propertyId);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Statement removed.");
      onChanged();
    });
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {statement.lender ?? "Loan statement"}
          </span>
          {confirmed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Confirmed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
              Needs review
            </span>
          )}
          {statement.confidence != null && !confirmed && (
            <span className="text-xs text-muted-foreground">
              {Math.round(statement.confidence * 100)}% confidence
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Remove statement"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {extractionFailed && (
        <p className="flex gap-2 text-xs text-amber-900 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          We couldn&apos;t read this document automatically. The file is saved —
          enter the interest from it below.
        </p>
      )}

      {extractedNotes && !extractionFailed && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {extractedNotes}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`interest-${statement.id}`}>Interest paid</Label>
          <Input
            id={`interest-${statement.id}`}
            inputMode="decimal"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
          />
          {edited && (
            <p className="text-xs text-muted-foreground">
              Extracted {formatCurrency(Number(originalInterest))} — your edit
              is used.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`lender-${statement.id}`}>Lender</Label>
          <Input
            id={`lender-${statement.id}`}
            value={lender}
            onChange={(e) => setLender(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`account-${statement.id}`}>Account</Label>
          <Input
            id={`account-${statement.id}`}
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={handleConfirm} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {confirmed ? "Save changes" : "Confirm interest"}
        </Button>
        {!confirmed && (
          <p className="text-xs text-muted-foreground">
            Not counted in the report until confirmed.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Upload, review and confirm annual loan statements for one financial year.
 *
 * Interest is the largest rental deduction and must tie to the lender's own
 * document, so nothing here is claimable until a human confirms it. Where no
 * confirmed statement exists the computed estimate is shown, clearly labelled
 * and explicitly excluded from the report's totals.
 */
export function LoanStatementsPanel({
  propertyId,
  financialYearEnd,
  financialYearLabel,
  statements,
  estimate,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const confirmedTotal = statements
    .filter((s) => s.confirmed_at != null && s.interest_paid != null)
    .reduce((sum, s) => sum + Number(s.interest_paid), 0);
  const hasConfirmed = statements.some((s) => s.confirmed_at != null);
  const pendingCount = statements.filter((s) => s.confirmed_at == null).length;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("propertyId", propertyId);
      body.append("financialYearEnd", String(financialYearEnd));

      const res = await fetch("/api/loan-statements/extract", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }
      toast.success(
        json.extractionError
          ? "Uploaded. We couldn't read it automatically — enter the interest."
          : "Uploaded. Check the extracted interest and confirm it.",
      );
      router.refresh();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Loan interest — {financialYearLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statements.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {estimate != null ? (
              <div className="space-y-1.5">
                <p>
                  No loan statement uploaded. From your loan terms, interest for
                  this year is roughly{" "}
                  <strong className="text-foreground">
                    {formatCurrency(estimate.interest)}
                  </strong>
                  . <strong>This is an estimate only</strong> — it will not tie
                  to your lender&apos;s figures and is{" "}
                  <strong>not included</strong> in the report. Upload the annual
                  statement to claim it.
                </p>
                <p>
                  Based on {estimate.daysCharged} of {estimate.daysInYear} days
                  {estimate.assumedFullYear
                    ? " (no loan start date recorded, so a full year is assumed)"
                    : ""}
                  , a balance of{" "}
                  {formatCurrency(estimate.interestBearingBalance)} after
                  offset, across{" "}
                  {estimate.rateSegments === 1
                    ? "one rate"
                    : `${estimate.rateSegments} rate periods`}
                  . It assumes the balance stayed constant, so for a
                  principal-and-interest loan the real figure will be lower.
                </p>
              </div>
            ) : (
              <p>
                No loan statement uploaded. Interest is usually the largest
                rental deduction — upload your lender&apos;s annual statement to
                include it.
              </p>
            )}
          </div>
        )}

        {statements.map((statement) => (
          <StatementRow
            key={statement.id}
            statement={statement}
            propertyId={propertyId}
            onChanged={() => router.refresh()}
          />
        ))}

        {statements.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Claimable interest for {financialYearLabel}
              {pendingCount > 0 && (
                <span className="ml-1 text-xs">
                  ({pendingCount} awaiting confirmation, not counted)
                </span>
              )}
            </span>
            <span className="font-semibold tabular-nums">
              {hasConfirmed ? formatCurrency(confirmedTotal) : "—"}
            </span>
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            Upload annual statement
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
