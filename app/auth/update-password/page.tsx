"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[a-z]/, "Must include a lowercase letter")
      .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedPassword = watch("password") ?? "";

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    router.push("/properties");
  }

  return (
    <main
      className="min-h-screen flex flex-col justify-center px-6 md:px-16 py-20 relative"
      style={{ backgroundColor: "#fbf9f9", color: "#1b1c1c" }}
    >
      <div className="absolute top-8 left-6 md:left-16">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold transition-colors"
          style={{ color: "#45474c" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Back to sign in
        </Link>
      </div>

      <div className="max-w-md mx-auto w-full">
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Home Base"
              width={160}
              height={125}
              className="h-12 w-auto"
            />
          </Link>
        </div>

        <h1
          className="font-caslon text-[32px] leading-10 mb-2"
          style={{ color: "#030813" }}
        >
          Set New Password
        </h1>
        <p className="text-base mb-8" style={{ color: "#45474c" }}>
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <div className="relative group">
              <Input id="password" type="password" {...register("password")} />
              <PasswordStrengthIndicator password={watchedPassword} />
            </div>
            {errors.password && (
              <p className="text-xs" style={{ color: "#ba1a1a" }}>
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs" style={{ color: "#ba1a1a" }}>
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 text-[11px] uppercase tracking-widest font-semibold transition-all flex justify-center items-center gap-2 group"
            style={{
              backgroundColor: "#030813",
              color: "#ffffff",
              fontFamily: "var(--font-grotesk)",
            }}
          >
            {loading ? "Updating…" : "Update Password"}
            {!loading && (
              <span
                className="material-symbols-outlined group-hover:translate-x-1 transition-transform"
                style={{ fontSize: 20 }}
              >
                chevron_right
              </span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
