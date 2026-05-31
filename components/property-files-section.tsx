"use client";

import { useRef, useState, useEffect } from "react";
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
import {
  FileText,
  Upload,
  Trash2,
  Plus,
  Pencil,
  FolderOpen,
} from "lucide-react";

function FolderInput({
  value,
  onChange,
  suggestions,
  id,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  id: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => !value || s.toLowerCase().includes(value.toLowerCase()),
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md text-sm overflow-hidden">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const [folderName, setFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] =
    useState<PropertyFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editFile, setEditFile] = useState<PropertyFile | null>(null);
  const [editName, setEditName] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingFolders = Array.from(
    new Set(files.map((f) => f.folder_name).filter(Boolean) as string[]),
  ).sort();

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
        folder_name: folderName.trim() || null,
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
    setFolderName("");
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
    const newFolder = editFolder.trim() || null;
    const { error } = await supabase
      .from("property_files")
      .update({ display_name: newName, folder_name: newFolder })
      .eq("id", editFile.id);
    if (error) {
      toast.error(error.message);
      setEditSaving(false);
      return;
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.id === editFile.id
          ? { ...f, display_name: newName, folder_name: newFolder }
          : f,
      ),
    );
    toast.success("File updated");
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
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Files</h2>
        </div>
        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) {
              setSelectedFile(null);
              setDisplayName("");
              setFolderName("");
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
              <div className="space-y-1.5">
                <Label htmlFor="folder_name">Folder (optional)</Label>
                <FolderInput
                  id="folder_name"
                  placeholder="e.g. Building & Pest, Purchase Docs"
                  value={folderName}
                  onChange={setFolderName}
                  suggestions={existingFolders}
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
        <div className="space-y-4">
          {[...existingFolders, null].map((folder) => {
            const groupFiles = files.filter((f) =>
              folder === null ? !f.folder_name : f.folder_name === folder,
            );
            if (groupFiles.length === 0) return null;
            return (
              <div key={folder ?? "__uncategorised__"}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 px-1">
                  {folder ?? "Uncategorised"}
                </p>
                <div className="divide-y">
                  {groupFiles.map((file) => (
                    <div
                      key={file.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-x-8 items-center px-1 py-1"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm text-left hover:underline truncate "
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
                      <div className="flex gap-1 justify-end">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => {
                            setEditFile(file);
                            setEditName(file.display_name ?? fileLabel(file));
                            setEditFolder(file.folder_name ?? "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          variant="ghost"
                          onClick={() => setConfirmDeleteFile(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit file dialog */}
      <Dialog
        open={editFile !== null}
        onOpenChange={(open) => {
          if (!open) setEditFile(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit file</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="edit_folder_name">Folder (optional)</Label>
              <FolderInput
                id="edit_folder_name"
                placeholder="e.g. Building & Pest, Purchase Docs"
                value={editFolder}
                onChange={setEditFolder}
                suggestions={existingFolders}
              />
            </div>
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
