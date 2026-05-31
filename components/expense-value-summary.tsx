"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RefreshCw, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateExpenseValueSummary } from "@/app/actions/contractors";

interface Props {
  expenseId: string;
  initial: { summary_text: string; is_edited: boolean } | null;
}

export function ExpenseValueSummary({ expenseId, initial }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initial?.summary_text ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/value-summary/${expenseId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setSummary(data.summary_text);
      router.refresh();
    } catch {
      toast.error("Could not regenerate summary");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await updateExpenseValueSummary(expenseId, draft.trim());
      setSummary(draft.trim());
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Could not save summary");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setDraft(summary ?? "");
    setEditing(true);
  }

  if (!summary && !regenerating) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[#E2E2E2] p-8 text-center space-y-3 bg-white">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0edff]">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
        </div>
        <div>
          <p className="font-grotesk text-[14px] font-semibold text-[#030813]">
            No value summary yet
          </p>
          <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
            Generate a narrative about what this work adds to the property.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#030813] px-4 py-2 font-grotesk text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate summary
        </button>
      </div>
    );
  }

  if (regenerating) {
    return (
      <div className="rounded-xl border border-[#E2E2E2] p-6 bg-white flex items-center gap-3">
        <RefreshCw className="h-4 w-4 animate-spin text-violet-500 shrink-0" />
        <p className="font-grotesk text-[14px] text-[#76777c]">Generating summary…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E2E2] bg-white p-5 space-y-3">
      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="font-grotesk text-[14px] text-[#030813] resize-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-grotesk text-[14px] leading-relaxed text-[#030813] italic">
            &ldquo;{summary}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 font-grotesk text-[12px] text-[#76777c] hover:text-[#030813] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1 font-grotesk text-[12px] text-[#76777c] hover:text-[#030813] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
