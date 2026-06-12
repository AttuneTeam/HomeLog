"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function DeleteAccountClient({ isGuest }: { isGuest: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch("/api/account/delete", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Failed to delete account")
        setLoading(false)
        return
      }
      toast.success("Account deleted")
      router.push("/login")
    } catch {
      toast.error("Something went wrong")
      setLoading(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmation("")
    setOpen(next)
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Delete account</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isGuest
            ? "Permanently delete your account and remove yourself from any accounts shared with you. The owner’s data stays intact — only your access and your own data are removed. This cannot be undone."
            : "Permanently delete your account, all properties, uploaded files, and associated data. This cannot be undone."}
        </p>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "shrink-0")}>
          Delete account
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              {isGuest ? (
                <>
                  This will permanently delete your account and remove your access to any accounts shared with you. The owner&apos;s data is <strong>not</strong> affected — only your login and your own data are removed. This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete your account and <strong>all associated data</strong> — properties, renovations, expenses, loans, rental records, and all uploaded files. This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label htmlFor="confirm-delete" className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmation !== "DELETE" || loading}
            >
              {loading ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
