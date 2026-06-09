"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, FolderInput } from "lucide-react";

interface Props {
  expenseId: string;
  currentRenovationId: string;
  propertyId: string;
  renovations: { id: string; name: string }[];
}

export function MoveExpenseMenu({
  expenseId,
  currentRenovationId,
  propertyId,
  renovations,
}: Props) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const otherRenovations = renovations.filter(
    (r) => r.id !== currentRenovationId,
  );

  async function handleMove() {
    if (!target) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .update({ renovation_id: target })
      .eq("id", expenseId);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Expense moved");
    setMoveOpen(false);
    setLoading(false);
    setTarget("");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" aria-label="Expense actions" />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={otherRenovations.length === 0}
            onClick={() => setMoveOpen(true)}
          >
            <FolderInput className="h-3.5 w-3.5 mr-2" />
            Move to another renovation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move expense</DialogTitle>
            <DialogDescription>
              Choose the renovation you want to move this expense to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Renovation</Label>
            <Select value={target} onValueChange={(v) => setTarget(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a renovation…">
                  {(value) =>
                    otherRenovations.find((r) => r.id === value)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {otherRenovations.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={loading || !target}>
              {loading ? "Moving…" : "Move expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
