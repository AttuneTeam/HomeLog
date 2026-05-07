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
import { cn, formatCurrency } from "@/lib/utils"
import { TrendingUp, Home } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { calculateStampDuty } from "@/lib/stamp-duty"

const schema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.string().optional(),
  stamp_duty: z.string().optional(),
  notes: z.string().optional(),
  property_type: z.enum(["investment", "primary_residence"]),
})

type FormValues = z.infer<typeof schema>

interface PropertyFormProps {
  userId: string
  defaultValues?: Partial<FormValues> & { id?: string; property_type?: string; stamp_duty?: string }
}

export function PropertyForm({ userId, defaultValues }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isEdit = !!defaultValues?.id

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: defaultValues?.address ?? "",
      suburb: defaultValues?.suburb ?? "",
      state: defaultValues?.state ?? "",
      postcode: defaultValues?.postcode ?? "",
      purchase_date: defaultValues?.purchase_date ?? "",
      purchase_price: defaultValues?.purchase_price ?? "",
      stamp_duty: defaultValues?.stamp_duty ?? "",
      notes: defaultValues?.notes ?? "",
      property_type: (defaultValues?.property_type as "investment" | "primary_residence") ?? "investment",
    },
  })

  const propertyType = watch("property_type")
  const watchedState = watch("state")
  const watchedPrice = watch("purchase_price")

  const stampDuty = calculateStampDuty(
    watchedState ?? "",
    parseFloat(watchedPrice ?? "0") || 0,
    propertyType,
  )

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const supabase = createClient()

    const payload = {
      address: values.address,
      suburb: values.suburb || null,
      state: values.state || null,
      postcode: values.postcode || null,
      purchase_date: values.purchase_date || null,
      purchase_price: values.purchase_price ? parseFloat(values.purchase_price) : null,
      stamp_duty: values.stamp_duty ? parseFloat(values.stamp_duty) : null,
      notes: values.notes || null,
      property_type: values.property_type,
    }

    if (isEdit) {
      const { error } = await supabase.from("properties").update(payload).eq("id", defaultValues!.id!)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success("Property updated")
      router.push(`/properties/${defaultValues!.id}`)
    } else {
      const { data, error } = await supabase.from("properties").insert({ ...payload, user_id: userId }).select().single()
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success("Property added")
      router.push(`/properties/${data.id}`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Property type */}
          <div className="space-y-2">
            <Label>Property type *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue("property_type", "investment")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all",
                  propertyType === "investment"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <TrendingUp className={cn("h-5 w-5", propertyType === "investment" ? "text-emerald-600" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium">Investment</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rental or investment property</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setValue("property_type", "primary_residence")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all",
                  propertyType === "primary_residence"
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <Home className={cn("h-5 w-5", propertyType === "primary_residence" ? "text-violet-600" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="font-medium">Primary Residence</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Owner-occupied home</p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Street address *</Label>
            <Input id="address" placeholder="123 Example St" {...register("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" placeholder="Suburb" {...register("suburb")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Select
                value={watchedState ?? ""}
                onValueChange={(v) => setValue("state", v ?? undefined, { shouldValidate: true })}
              >
                <SelectTrigger id="state" className="w-full">
                  <SelectValue placeholder="State…" />
                </SelectTrigger>
                <SelectContent>
                  {["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" placeholder="3000" {...register("postcode")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_date">Purchase date</Label>
              <Input id="purchase_date" type="date" {...register("purchase_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase_price">Purchase price ($)</Label>
              <Input id="purchase_price" type="number" step="0.01" placeholder="500000" {...register("purchase_price")} />
            </div>
          </div>

          {stampDuty !== null && (
            <div className="flex items-center justify-between rounded-lg border border-muted bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Estimated stamp duty</span>
              <span className="font-semibold tabular-nums">{formatCurrency(stampDuty)}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="stamp_duty">Stamp duty paid ($)</Label>
            <div className="flex gap-2">
              <Input
                id="stamp_duty"
                type="number"
                step="0.01"
                placeholder="0"
                className="flex-1"
                {...register("stamp_duty")}
              />
              {stampDuty !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setValue("stamp_duty", String(stampDuty))}
                >
                  Use estimate
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Any additional notes about this property…" rows={3} {...register("notes")} />
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add property"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
