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

export function InviteSignupForm({ token, inviteEmail, inviteType, propertyId }: Props) {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: inviteEmail,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: `${window.location.origin}/invite/${token}`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Session is available when email confirmation is disabled — accept the invite now
    if (data.session && data.user) {
      const table = inviteType === "account" ? "account_members" : "property_shares";
      const { error: updateError } = await supabase
        .from(table)
        .update({ status: "active", grantee_user_id: data.user.id })
        .eq("invite_token", token);

      if (updateError) {
        toast.error("Account created but invite could not be accepted. Please try signing in.");
        window.location.href = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;
        return;
      }

      const redirectTo =
        inviteType === "property" && propertyId
          ? `/properties/${propertyId}?invite=accepted`
          : `/?invite=accepted`;
      window.location.href = redirectTo;
      return;
    }

    // Email confirmation is required — wait for the user to verify
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        We sent a confirmation link to <strong>{inviteEmail}</strong>. Click it to verify your
        account, then return here to accept the invitation.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={inviteEmail} disabled className="bg-muted" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Your name</Label>
        <Input id="displayName" placeholder="Alex Smith" {...register("displayName")} />
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
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
