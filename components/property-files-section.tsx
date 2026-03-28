"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PropertyFile } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
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
import { FileText, Upload, Trash2, Plus, Pencil } from "lucide-react";

interface PropertyFilesSectionProps {
  propertyId: string;
  userId: string;
  initialFiles: PropertyFile[];
}

export function PropertyFilesSection({
  propertyId,
  userId,
  initialFiles,
}: PropertyFilesSectionProps) {
  const [files, setFiles] = useState<PropertyFile[]>(initialFiles);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] =
    useState<PropertyFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editFile, setEditFile] = useState<PropertyFile | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    const supabase = createClient();
    const ext = selectedFile.name.split(".").pop();
    const path = `${userId}/${propertyId}/${Date.now()}.${ext}`;
    const { error: storageError } = await supabase.storage
      .from("property-files")
      .upload(path, selectedFile);
    if (storageError) {
      toast.error(`Upload failed: ${storageError.message}`);
      setUploading(false);
      return;
    }
    const { data, error: dbError } = await supabase
      .from("property_files")
      .insert({
        property_id: propertyId,
        storage_path: path,
        display_name: displayName.trim() || null,
      })
      .select()
      .single();
    if (dbError) {
      toast.error(dbError.message);
      setUploading(false);
      return;
    }
    setFiles((prev) => [data as PropertyFile, ...prev]);
    toast.success("File uploaded");
    setUploadOpen(false);
    setSelectedFile(null);
    setDisplayName("");
    setUploading(false);
  }

  async function handleDownload(storagePath: string) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("property-files")
      .createSignedUrl(storagePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not generate download link");
  }

  async function handleDelete() {
    if (!confirmDeleteFile) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.storage
      .from("property-files")
      .remove([confirmDeleteFile.storage_path]);
    const { error } = await supabase
      .from("property_files")
      .delete()
      .eq("id", confirmDeleteFile.id);
    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== confirmDeleteFile.id));
    toast.success("File removed");
    setDeleting(false);
    setConfirmDeleteFile(null);
  }

  async function handleEditSave() {
    if (!editFile) return;
    setEditSaving(true);
    const supabase = createClient();
    const newName = editName.trim() || null;
    const { error } = await supabase
      .from("property_files")
      .update({ display_name: newName })
      .eq("id", editFile.id);
    if (error) {
      toast.error(error.message);
      setEditSaving(false);
      return;
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.id === editFile.id ? { ...f, display_name: newName } : f,
      ),
    );
    toast.success("Name updated");
    setEditSaving(false);
    setEditFile(null);
  }

  function fileLabel(file: PropertyFile) {
    if (file.display_name) return file.display_name;
    return file.storage_path.split("/").pop() ?? "File";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Files attached</h2>
        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) {
              setSelectedFile(null);
              setDisplayName("");
            }
          }}
        >
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Upload file
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload file</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
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
                  className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Click to select a file
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="display_name">Display name (optional)</Label>
                <Input
                  id="display_name"
                  placeholder="e.g. Strata Report, Contract of Sale"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No files attached</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload contracts, reports, or any property documents
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-8 px-1 pb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              File
            </span>
          </div>
          <div className="divide-y">
            {files.map((file) => (
              <div
                key={file.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-8 items-center px-1 py-1"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-left hover:underline truncate"
                  onClick={() => handleDownload(file.storage_path)}
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{fileLabel(file)}</span>
                </button>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(file.created_at).toLocaleString("en-AU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setEditFile(file);
                      setEditName(file.display_name ?? fileLabel(file));
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    onClick={() => setConfirmDeleteFile(file)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit name dialog */}
      <Dialog
        open={editFile !== null}
        onOpenChange={(open) => {
          if (!open) setEditFile(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="edit_display_name">Display name</Label>
            <Input
              id="edit_display_name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditFile(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteFile !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteFile(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove file?</DialogTitle>
          </DialogHeader>
          {confirmDeleteFile && (
            <p className="text-sm text-muted-foreground">
              &ldquo;{fileLabel(confirmDeleteFile)}&rdquo; will be permanently
              deleted.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteFile(null)}
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
