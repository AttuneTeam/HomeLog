"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  tenantId: string;
  tenantName: string | null;
  propertyId: string;
  propertyAddress: string;
  fyStart: string;
  fyEnd: string;
  financialYear: string;
}

export function XeroExportButton({
  tenantId,
  tenantName,
  propertyId,
  propertyAddress,
  fyStart,
  fyEnd,
  financialYear,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<{ completedAt: string } | null>(
    null,
  );

  async function handleExport(force = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/xero/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          propertyId,
          fyStart,
          fyEnd,
          financialYear,
          force,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.error === "duplicate") {
        setDuplicate({ completedAt: data.completedAt });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.message ?? "Export to Xero failed");
        setOpen(false);
        setLoading(false);
        return;
      }

      toast.success(`Exported to Xero — ${data.recordCount} lines created`);
      setOpen(false);
      setDuplicate(null);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setDuplicate(null);
      }}
    >
      <DialogTrigger
        className={cn(
          buttonVariants({ size: "default" }),
          "bg-[#13B5EA] hover:bg-[#0fa3d4] text-white border-transparent",
        )}
      >
        Export to Xero
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export to Xero</DialogTitle>
          <DialogDescription>
            This will create a Manual Journal in{" "}
            <strong>{tenantName ?? "your Xero organisation"}</strong> for{" "}
            <strong>{propertyAddress}</strong> covering financial year{" "}
            <strong>FY {financialYear}</strong>.
          </DialogDescription>
        </DialogHeader>

        {duplicate ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-sm space-y-1">
            <p className="font-medium text-amber-800 dark:text-amber-400">
              Already exported
            </p>
            <p className="text-muted-foreground">
              This property was already exported for FY {financialYear} on{" "}
              {new Date(duplicate.completedAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              . Exporting again will create a second journal entry in Xero.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The export creates a single balanced Manual Journal entry. Your
            accountant can review and reconcile it in Xero before lodging the
            tax return.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setDuplicate(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleExport(duplicate ? true : false)}
            disabled={loading}
          >
            {loading
              ? "Exporting…"
              : duplicate
                ? "Export anyway"
                : "Export to Xero"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
