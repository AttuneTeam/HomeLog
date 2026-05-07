"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Leaf, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step = "idle" | "extracting" | "classifying" | "done" | "error";

type Classification =
  | "Immediate Deduction"
  | "Capital Works (Div 43)"
  | "Plant & Equipment (Div 40)";

type ManualClassification = "Immediate Deduction" | "Repair" | "Capital Works";

interface AiClassification {
  classification: Classification;
  deduction_strategy: string;
  legal_citation: string;
  environmental_flag: boolean;
  confidence_score: number;
  created_at: string;
  model_used: string;
}

interface Props {
  expenseId: string;
  existingClassification: AiClassification | null;
  existingManualClassification?: ManualClassification | null;
  hasExtractedText?: boolean;
  contextNotes?: string | null;
}

const BADGE_STYLES: Record<Classification, string> = {
  "Immediate Deduction": "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-100",
  "Capital Works (Div 43)": "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100",
  "Plant & Equipment (Div 40)": "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100",
};

const STEP_MESSAGES: Partial<Record<Step, string>> = {
  extracting: "Extracting invoice text...",
  classifying: "Retrieving ATO rulings & classifying...",
};

const AI_TO_MANUAL: Record<Classification, ManualClassification> = {
  "Immediate Deduction": "Immediate Deduction",
  "Capital Works (Div 43)": "Capital Works",
  "Plant & Equipment (Div 40)": "Capital Works",
};

const MANUAL_OPTIONS: ManualClassification[] = [
  "Immediate Deduction",
  "Repair",
  "Capital Works",
];

export function AiTaxClassificationPanel({
  expenseId,
  existingClassification,
  existingManualClassification,
  hasExtractedText = false,
  contextNotes,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(existingClassification ? "done" : "idle");
  const [result, setResult] = useState<AiClassification | null>(existingClassification);
  const [error, setError] = useState<string | null>(null);
  const [textExtracted, setTextExtracted] = useState(hasExtractedText);
  const [manualClassification, setManualClassification] = useState<ManualClassification | "">(
    existingManualClassification ??
      (existingClassification ? AI_TO_MANUAL[existingClassification.classification] : "")
  );
  const [savedManual, setSavedManual] = useState<ManualClassification | "">(
    existingManualClassification ??
      (existingClassification ? AI_TO_MANUAL[existingClassification.classification] : "")
  );
  const [isSaving, setIsSaving] = useState(false);

  const isLoading = step === "extracting" || step === "classifying";
  const hasResult = step === "done" && result;
  const isDirty = manualClassification !== savedManual;

  async function handleClassify() {
    setError(null);

    if (!textExtracted) {
      setStep("extracting");
      const r1 = await fetch(`/api/extract/${expenseId}`, { method: "POST" });
      if (!r1.ok) {
        const json = await r1.json().catch(() => ({}));
        setError(json.error ?? "Invoice extraction failed. Make sure an invoice is attached.");
        setStep("error");
        return;
      }
      setTextExtracted(true);
    }

    setStep("classifying");
    const r2 = await fetch(`/api/classify/${expenseId}`, { method: "POST" });
    const json = await r2.json().catch(() => ({}));

    if (!r2.ok) {
      setError(json.error ?? "Classification failed. Please try again.");
      setStep("error");
      return;
    }

    const aiClassification: Classification = json.classification.classification;
    const mapped = AI_TO_MANUAL[aiClassification];

    setResult({ ...json.classification, created_at: new Date().toISOString(), model_used: "gpt-5.5" });
    setManualClassification(mapped);
    setSavedManual(mapped);
    setStep("done");
    router.refresh();
  }

  async function handleSaveManual() {
    if (!manualClassification) return;
    setIsSaving(true);
    try {
      const r = await fetch(`/api/expenses/${expenseId}/manual-classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: manualClassification }),
      });
      if (r.ok) {
        setSavedManual(manualClassification);
        router.refresh();
      }
    } finally {
      setIsSaving(false);
    }
  }

  const confidencePct = result ? Math.round(result.confidence_score * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">Tax Classification</CardTitle>
            {result && <p className="text-xs text-muted-foreground mt-0.5">Powered by · {result.model_used}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={handleClassify} disabled={isLoading}>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {STEP_MESSAGES[step]}
              </>
            ) : hasResult ? "Re-classify" : "Classify with AI"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{STEP_MESSAGES[step]}</span>
          </div>
        )}

        {step === "error" && error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {contextNotes && (
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Additional context provided</p>
            <p className="text-muted-foreground">{contextNotes}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manual Classification</p>
          <div className="flex items-center gap-2">
            <Select
              value={manualClassification}
              onValueChange={(v) => setManualClassification(v as ManualClassification)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select classification..." />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDirty && (
              <Button size="sm" onClick={handleSaveManual} disabled={isSaving || !manualClassification}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            )}
          </div>
        </div>

        {step === "idle" && !manualClassification && (
          <p className="text-sm text-muted-foreground">
            Click &ldquo;Classify with AI&rdquo; to analyse this expense against ATO rulings and determine its tax treatment.
          </p>
        )}

        {hasResult && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <Badge variant="outline" className={`text-sm font-medium px-3 py-1 ${BADGE_STYLES[result.classification]}`}>
                {result.classification}
              </Badge>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-sm font-semibold">{confidencePct}%</p>
              </div>
            </div>

            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${confidencePct}%` }} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Deduction Strategy</p>
              <p className="text-sm">{result.deduction_strategy}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Legal Citation</p>
              <p className="text-sm font-medium">{result.legal_citation}</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Leaf className={`h-4 w-4 shrink-0 ${result.environmental_flag ? "text-green-600" : "text-muted-foreground"}`} />
              <span className={result.environmental_flag ? "text-green-700 font-medium" : "text-muted-foreground"}>
                Environmental flag: {result.environmental_flag ? "Yes — s 40-755 may apply" : "No"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3">
              Classified {new Date(result.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
