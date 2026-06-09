"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, Loader2 } from "lucide-react"

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>
type Status = "loading" | "ready" | "invalid"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const supabase = createClient()

    // PKCE path: Supabase appended ?code=... to the redirect URL
    const code = new URLSearchParams(window.location.search).get("code")
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        setStatus(error ? "invalid" : "ready")
      })
    }

    // Implicit path: Supabase put tokens in the URL hash; the client library
    // reads them and fires PASSWORD_RECOVERY before we can inspect the hash ourselves.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready")
    })

    // If neither path resolves within 5 s the link is expired or already used.
    const timer = setTimeout(
      () => setStatus((s) => (s === "loading" ? "invalid" : s)),
      5000,
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.password })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Password updated")
    router.push("/properties")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Home className="h-7 w-7" />
            <span className="text-2xl font-bold tracking-tight">Home Base</span>
          </div>
        </div>

        {status === "loading" && (
          <Card>
            <CardContent className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {status === "invalid" && (
          <Card>
            <CardHeader>
              <CardTitle>Link expired</CardTitle>
              <CardDescription>
                This password reset link is invalid or has already been used.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => router.push("/forgot-password")}>
                Request a new link
              </Button>
            </CardFooter>
          </Card>
        )}

        {status === "ready" && (
          <Card>
            <CardHeader>
              <CardTitle>Set new password</CardTitle>
              <CardDescription>Choose a strong password for your account.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" type="password" placeholder="••••••••" {...register("confirmPassword")} />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Updating…" : "Update password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
