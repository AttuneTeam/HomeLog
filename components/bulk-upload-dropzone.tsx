"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createStagedReceipt } from "@/app/actions/staged-receipts";
import { mimeTypeFromPath } from "@/lib/ai/extract-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.webp";
const ACCEPTED_RE = /\.(pdf|jpg|jpeg|png|heic|webp)$/i;
const MAX_BATCH = 200;

type UploadPhase = "uploading" | "done" | "error";

interface UploadItem {
  name: string;
  phase: UploadPhase;
}

export interface PropertyChoice {
  id: string;
  address: string;
}

export function BulkUploadDropzone({
  userId,
  properties,
}: {
  userId: string;
  properties: PropertyChoice[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const doneCount = items.filter((i) => i.phase !== "uploading").length;
  const ready = Boolean(propertyId) && !uploading;

  async function uploadAll(files: File[]) {
    if (!propertyId) {
      toast.error("Choose a property first");
      return;
    }
    if (files.length > MAX_BATCH) {
      toast.error(`Too many files — up to ${MAX_BATCH} per import. You dropped ${files.length}.`);
      return;
    }
    setUploading(true);
    setItems(files.map((f) => ({ name: f.name, phase: "uploading" as const })));

    const supabase = createClient();
    let uploaded = 0;

    await Promise.all(
      files.map(async (file, i) => {
        try {
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
          const path = `${userId}/staging/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("invoices").upload(path, file);
          if (error) throw new Error(error.message);

          await createStagedReceipt({
            storagePath: path,
            originalFilename: file.name,
            contentType: file.type || mimeTypeFromPath(file.name),
            propertyId,
            source: "bulk_upload",
          });
          uploaded++;
          setItems((prev) => prev.map((it, j) => (j === i ? { ...it, phase: "done" } : it)));
        } catch {
          setItems((prev) => prev.map((it, j) => (j === i ? { ...it, phase: "error" } : it)));
        }
      }),
    );

    setUploading(false);
    if (uploaded > 0) {
      toast.success(`${uploaded} receipt${uploaded !== 1 ? "s" : ""} uploaded — extracting…`);
      router.push("/import/review");
    } else {
      toast.error("No files could be uploaded");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!ready) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => ACCEPTED_RE.test(f.name));
    if (files.length) uploadAll(files);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadAll(files);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Property</label>
        <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a property…">
              {(value) => properties.find((p) => p.id === value)?.address}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Receipts in this import are added to the selected property.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (ready) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => ready && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          ready ? "cursor-pointer" : "cursor-not-allowed opacity-60"
        } ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={onInputChange}
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm font-medium">
                Uploading {doneCount} of {items.length}…
              </p>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7" />
              <p className="text-sm font-medium">Drop receipts here to bulk import</p>
              <p className="text-xs">PDF, JPG, PNG, HEIC, WebP — up to {MAX_BATCH} at once</p>
            </>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{it.name}</span>
              {it.phase === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {it.phase === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {it.phase === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
