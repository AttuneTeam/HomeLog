"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Wrench, TrendingUp } from "lucide-react"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  contractor: z.string().optional(),
  status: z.enum(["planned", "in_progress", "completed"]),
  classification: z.enum(["repair", "capital_improvement"]),
  notes: z.string().optional(),
  claimable: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface RenovationFormProps {
  propertyId: string
  defaultValues?: Partial<FormValues> & { id?: string }
}

export function RenovationForm({ propertyId, defaultValues }: RenovationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isEdit = !!defaultValues?.id

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      contractor: defaultValues?.contractor ?? "",
      status: defaultValues?.status ?? "planned",
      classification: defaultValues?.classification ?? "repair",
      notes: defaultValues?.notes ?? "",
      claimable: defaultValues?.claimable ?? true,
    },
  })

  const classification = watch("classification")
  const status = watch("status")
  const claimable = watch("claimable")

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const supabase = createClient()

    const payload = {
      name: values.name,
      description: values.description || null,
      contractor: values.contractor || null,
      status: values.status,
      classification: values.classification,
      notes: values.notes || null,
      claimable: values.claimable,
    }

    if (isEdit) {
      const { error } = await supabase.from("renovations").update(payload).eq("id", defaultValues!.id!)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success("Renovation updated")
      router.push(`/properties/${propertyId}/renovations/${defaultValues!.id}`)
    } else {
      const { data, error } = await supabase.from("renovations").insert({ ...payload, property_id: propertyId }).select().single()
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success("Renovation added")
      router.push(`/properties/${propertyId}/renovations/${data.id}`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Renovation name *</Label>
            <Input id="name" placeholder="Kitchen renovation" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Tax classification — prominent choice */}
          <div className="space-y-2">
            <Label>Tax classification *</Label>
            <p className="text-xs text-muted-foreground">This determines how the renovation is treated for tax purposes</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue("classification", "repair")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all",
                  classification === "repair"
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <Wrench className={cn("h-5 w-5", classification === "repair" ? "text-sky-600" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium">Repair</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Immediate tax deduction</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setValue("classification", "capital_improvement")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all",
                  classification === "capital_improvement"
                    ? "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <TrendingUp className={cn("h-5 w-5", classification === "capital_improvement" ? "text-amber-600" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium">Capital Improvement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Adds to cost base (reduces CGT)</p>
                </div>
              </button>
            </div>
          </div>

          {/* Non-claimable toggle */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all",
              !claimable
                ? "border-orange-400 bg-orange-50"
                : "border-border hover:border-muted-foreground/30"
            )}
            onClick={() => setValue("claimable", !claimable)}
          >
            <div className={cn(
              "mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
              !claimable ? "border-orange-500 bg-orange-500" : "border-muted-foreground/40"
            )}>
              {!claimable && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium leading-none">Non-claimable improvement (in-house / cash)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Done in-house or paid with cash — excluded from tax deductions and cost base calculations.
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["planned", "in_progress", "completed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue("status", s)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    status === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {s === "planned" ? "Planned" : s === "in_progress" ? "In progress" : "Completed"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contractor">Contractor / supplier</Label>
            <Input id="contractor" placeholder="ABC Builders" {...register("contractor")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Brief description of the work…" rows={2} {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Any other notes…" rows={2} {...register("notes")} />
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add renovation"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
