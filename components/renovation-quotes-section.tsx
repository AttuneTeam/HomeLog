"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Upload,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
  Leaf,
  Pencil,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AiClassificationResult } from "@/lib/ai/classification-schema";

interface QuoteClassification extends AiClassificationResult {
  created_at: string;
}

interface RenovationQuote {
  id: string;
  renovation_id: string;
  title: string;
  description: string | null;
  total_cost: number | null;
  contractor: string | null;
  file_path: string | null;
  created_at: string;
  quote_ai_classifications: QuoteClassification[] | null;
}

interface Props {
  renovationId: string;
  userId: string;
  initialQuotes: RenovationQuote[];
}

const BADGE_STYLES: Record<AiClassificationResult["classification"], string> = {
  "Immediate Deduction":
    "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-100",
  "Capital Works (Div 43)":
    "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100",
  "Plant & Equipment (Div 40)":
    "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100",
};

export function RenovationQuotesSection({
  renovationId,
  userId,
  initialQuotes,
}: Props) {
  const [quotes, setQuotes] = useState<RenovationQuote[]>(initialQuotes);
  const [addOpen, setAddOpen] = useState(false);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [contractor, setContractor] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editQuote, setEditQuote] = useState<RenovationQuote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTotalCost, setEditTotalCost] = useState("");
  const [editContractor, setEditContractor] = useState("");
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  function openEdit(quote: RenovationQuote) {
    setEditQuote(quote);
    setEditTitle(quote.title);
    setEditDescription(quote.description ?? "");
    setEditTotalCost(quote.total_cost != null ? String(quote.total_cost) : "");
    setEditContractor(quote.contractor ?? "");
    setEditSelectedFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function closeEdit() {
    setEditQuote(null);
    setEditSelectedFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setTotalCost("");
    setContractor("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();

    let filePath: string | null = null;
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop();
      filePath = `${userId}/${renovationId}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("renovation-quotes")
        .upload(filePath, selectedFile);
      if (storageError) {
        toast.error(`Upload failed: ${storageError.message}`);
        setSaving(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("renovation_quotes")
      .insert({
        renovation_id: renovationId,
        title: title.trim(),
        description: description.trim() || null,
        total_cost: totalCost ? Number(totalCost) : null,
        contractor: contractor.trim() || null,
        file_path: filePath,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    setQuotes((prev) => [
      { ...data, quote_ai_classifications: null } as RenovationQuote,
      ...prev,
    ]);
    toast.success("Quote added");
    setAddOpen(false);
    resetForm();
    setSaving(false);
  }

  async function handleDownload(filePath: string) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("renovation-quotes")
      .createSignedUrl(filePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not generate download link");
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const supabase = createClient();

    const quote = quotes.find((q) => q.id === confirmDeleteId);
    if (quote?.file_path) {
      await supabase.storage
        .from("renovation-quotes")
        .remove([quote.file_path]);
    }

    const { error } = await supabase
      .from("renovation_quotes")
      .delete()
      .eq("id", confirmDeleteId);

    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }

    setQuotes((prev) => prev.filter((q) => q.id !== confirmDeleteId));
    toast.success("Quote removed");
    setDeleting(false);
    setConfirmDeleteId(null);
  }

  async function handleClassify(quoteId: string) {
    setClassifyingId(quoteId);
    const res = await fetch(`/api/classify/quote/${quoteId}`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(json.error ?? "Classification failed");
      setClassifyingId(null);
      return;
    }

    const classification: QuoteClassification = {
      classification: json.classification.classification,
      deduction_strategy: json.classification.deduction_strategy,
      legal_citation: json.classification.legal_citation,
      environmental_flag: json.classification.environmental_flag,
      confidence_score: json.classification.confidence_score,
      created_at: new Date().toISOString(),
    };

    setQuotes((prev) =>
      prev.map((q) =>
        q.id === quoteId
          ? { ...q, quote_ai_classifications: [classification] }
          : q,
      ),
    );
    setClassifyingId(null);
  }

  async function handleEditSave() {
    if (!editQuote || !editTitle.trim()) return;
    setEditSaving(true);
    const supabase = createClient();

    let filePath = editQuote.file_path;

    if (editSelectedFile) {
      const ext = editSelectedFile.name.split(".").pop();
      const newPath = `${userId}/${renovationId}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("renovation-quotes")
        .upload(newPath, editSelectedFile);
      if (storageError) {
        toast.error(`Upload failed: ${storageError.message}`);
        setEditSaving(false);
        return;
      }
      if (editQuote.file_path) {
        await supabase.storage
          .from("renovation-quotes")
          .remove([editQuote.file_path]);
      }
      filePath = newPath;
    }

    const { error } = await supabase
      .from("renovation_quotes")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        total_cost: editTotalCost ? Number(editTotalCost) : null,
        contractor: editContractor.trim() || null,
        file_path: filePath,
      })
      .eq("id", editQuote.id);

    if (error) {
      toast.error(error.message);
      setEditSaving(false);
      return;
    }

    setQuotes((prev) =>
      prev.map((q) =>
        q.id === editQuote.id
          ? {
              ...q,
              title: editTitle.trim(),
              description: editDescription.trim() || null,
              total_cost: editTotalCost ? Number(editTotalCost) : null,
              contractor: editContractor.trim() || null,
              file_path: filePath,
            }
          : q,
      ),
    );
    toast.success("Quote updated");
    setEditSaving(false);
    closeEdit();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Quotes</h2>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add quote
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add quote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="q_title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="q_title"
                  placeholder="e.g. Bathroom retile — Smith Tiling Co."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q_description">Description (optional)</Label>
                <Textarea
                  id="q_description"
                  placeholder="Scope of work, materials, inclusions…"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q_cost">Total cost (optional)</Label>
                  <Input
                    id="q_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q_contractor">Contractor (optional)</Label>
                  <Input
                    id="q_contractor"
                    placeholder="e.g. Smith Tiling Co."
                    value={contractor}
                    onChange={(e) => setContractor(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Quote file (optional)</Label>
                {selectedFile ? (
                  <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Click to attach quote document
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!title.trim() || saving}>
                {saving ? "Saving…" : "Add quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No quotes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record written quotes you have received for this renovation
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const aiResult = quote.quote_ai_classifications?.[0] ?? null;
            const isClassifying = classifyingId === quote.id;
            const confidencePct = aiResult
              ? Math.round(aiResult.confidence_score * 100)
              : 0;

            return (
              <div
                key={quote.id}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-snug">
                      {quote.title}
                    </p>
                    {quote.contractor && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quote.contractor}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {quote.total_cost != null && (
                      <span className="text-sm font-semibold">
                        {formatCurrency(Number(quote.total_cost))}
                      </span>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openEdit(quote)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="destructive"
                      onClick={() => setConfirmDeleteId(quote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {quote.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {quote.description}
                  </p>
                )}

                {/* Footer row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {quote.file_path && (
                    <button
                      type="button"
                      onClick={() => handleDownload(quote.file_path!)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View file
                    </button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClassify(quote.id)}
                    disabled={isClassifying}
                    className="h-7 text-xs"
                  >
                    {isClassifying ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Classifying…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        {aiResult ? "Re-classify" : "Classify with AI"}
                      </>
                    )}
                  </Button>
                </div>

                {/* AI result */}
                {aiResult && (
                  <div className="rounded-md bg-muted/50 border px-3 py-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${BADGE_STYLES[aiResult.classification]}`}
                      >
                        {aiResult.classification}
                      </Badge>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${confidencePct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {confidencePct}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {aiResult.deduction_strategy}
                    </p>
                    <p className="text-xs font-medium">{aiResult.legal_citation}</p>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Leaf
                        className={`h-3.5 w-3.5 shrink-0 ${aiResult.environmental_flag ? "text-green-600" : "text-muted-foreground"}`}
                      />
                      <span className={aiResult.environmental_flag ? "text-green-700 font-medium" : "text-muted-foreground"}>
                        Environmental flag: {aiResult.environmental_flag ? "Yes — s 40-755 may apply" : "No"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editQuote !== null} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq_title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eq_title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq_description">Description (optional)</Label>
              <Textarea
                id="eq_description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eq_cost">Total cost (optional)</Label>
                <Input
                  id="eq_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editTotalCost}
                  onChange={(e) => setEditTotalCost(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq_contractor">Contractor (optional)</Label>
                <Input
                  id="eq_contractor"
                  placeholder="e.g. Smith Tiling Co."
                  value={editContractor}
                  onChange={(e) => setEditContractor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Quote file</Label>
              {editSelectedFile ? (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{editSelectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSelectedFile(null);
                      if (editFileInputRef.current) editFileInputRef.current.value = "";
                    }}
                    className="text-destructive hover:text-destructive/80"
                  >
                    ×
                  </button>
                </div>
              ) : editQuote?.file_path ? (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-muted-foreground truncate">Existing file attached</span>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Click to attach quote document
                </button>
              )}
              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                className="hidden"
                onChange={(e) => setEditSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={!editTitle.trim() || editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove quote?</DialogTitle>
          </DialogHeader>
          {confirmDeleteId && (
            <p className="text-sm text-muted-foreground">
              &ldquo;
              {quotes.find((q) => q.id === confirmDeleteId)?.title}
              &rdquo; and any attached file will be permanently deleted.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
