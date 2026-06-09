"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    displayName: z.string().min(1, "Name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  token: string;
  inviteEmail: string;
  inviteType: "account" | "property";
  propertyId?: string;
}

export function InviteSignupForm({
  token,
  inviteEmail,
  inviteType,
  propertyId,
}: Props) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);

    const res = await fetch("/api/invite/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        email: inviteEmail,
        password: values.password,
        displayName: values.displayName,
        inviteType,
        propertyId,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: inviteEmail,
      password: values.password,
    });

    if (signInError) {
      toast.error("Account created — please sign in to continue.");
      window.location.href = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;
      return;
    }

    window.location.href = json.redirectTo;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={inviteEmail} disabled className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Your name</Label>
        <Input
          id="displayName"
          placeholder="Alex Smith"
          {...register("displayName")}
        />
        {errors.displayName && (
          <p className="text-xs text-destructive">
            {errors.displayName.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Accept & create account"}
      </Button>

      <p className="text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
