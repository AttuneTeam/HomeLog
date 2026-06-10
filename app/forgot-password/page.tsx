"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: "Something went wrong" }));
      toast.error(error ?? "Something went wrong");
      return;
    }
    setSent(true);
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
          Reset Password
        </h1>
        <p className="text-base mb-8" style={{ color: "#45474c" }}>
          {sent
            ? "Check your email for a reset link. It may take a minute to arrive."
            : "Enter your email and we'll send you a link to reset your password."}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs" style={{ color: "#ba1a1a" }}>
                  {errors.email.message}
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
              {loading ? "Sending…" : "Send Reset Link"}
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
        ) : (
          <div
            className="border p-6 text-sm"
            style={{
              borderColor: "rgba(198,198,204,0.6)",
              color: "#45474c",
              backgroundColor: "#f5f3f3",
              fontFamily: "var(--font-grotesk)",
            }}
          >
            We&apos;ve sent a reset link to your inbox. Didn&apos;t get it?
            Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-bold hover:underline"
              style={{ color: "#030813" }}
            >
              try again
            </button>
            .
          </div>
        )}

        <div className="mt-12 text-center">
          <p
            className="text-sm"
            style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
          >
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-bold hover:underline"
              style={{ color: "#030813" }}
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
