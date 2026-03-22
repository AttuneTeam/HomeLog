"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function DeleteExpenseButton({ expenseId, renovationId, propertyId }: { expenseId: string; renovationId: string; propertyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()

    const { data: expense } = await supabase.from("expenses").select("invoice_path").eq("id", expenseId).single()
    if (expense?.invoice_path) {
      await supabase.storage.from("invoices").remove([expense.invoice_path])
    }

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId)
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success("Expense deleted")
    router.push(`/properties/${propertyId}/renovations/${renovationId}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-destructive hover:text-destructive")}>
        <Trash2 className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete expense?</DialogTitle>
          <DialogDescription>This will permanently delete the expense and remove any associated invoice file. This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting…" : "Delete expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
