"use client";

import { Suspense } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import Image from "next/image";

const schema = z
  .object({
    displayName: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email"),
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

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
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
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Account created! You can now sign in.");
    const loginHref =
      redirectTo === "/"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(redirectTo)}`;
    router.push(loginHref);
  }

  const loginHref =
    redirectTo === "/"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <main
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: "#fbf9f9", color: "#1b1c1c" }}
    >
      {/* Left Side: Value Propositions */}
      <section
        className="hidden md:flex w-full md:w-1/2 lg:w-3/5 flex-col justify-center px-16 py-20"
        style={{ backgroundColor: "#f5f3f3" }}
      >
        <div className="max-w-xl">
          <div className="mb-16">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Home Base"
                width={160}
                height={125}
                className="h-14 w-auto"
              />
            </Link>
          </div>
          <div className="space-y-12">
            <ValueProp
              icon="payments"
              title="Seamless Expense Tracking"
              body="Stay compliant effortlessly with automated receipt capture and categorization."
            />
            <ValueProp
              icon="menu_book"
              title="Beautiful Home Passport"
              body="Your property's digital legacy. A curated history of every repair, colour, and improvement."
            />
            <ValueProp
              icon="analytics"
              title="Renovation Intelligence"
              body="Expert data at your fingertips. Make informed decisions based on local heritage and value trends."
            />
          </div>
        </div>
      </section>

      {/* Right Side: Form */}
      <section
        className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center px-6 md:px-16 py-20 relative"
        style={{ backgroundColor: "#fbf9f9" }}
      >
        <div className="absolute top-8 left-6 md:left-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold transition-colors"
            style={{ color: "#45474c" }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18 }}
            >
              arrow_back
            </span>
            Return
          </Link>
        </div>

        <div className="max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="flex justify-center mb-10 md:hidden">
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
            Create Account
          </h1>
          <p className="text-base mb-8" style={{ color: "#45474c" }}>
            {redirectTo.startsWith("/invite")
              ? "Create an account to accept your invitation."
              : "Create your free account. No credit card required"}
          </p>

          {/* Social sign-in */}
          <div className="space-y-3 mb-8">
            <GoogleSignInButton
              redirectTo={redirectTo === "/" ? "/properties" : redirectTo}
            />
          </div>

          <div className="relative flex items-center mb-8">
            <div
              className="flex-grow border-t"
              style={{ borderColor: "rgba(198,198,204,0.4)" }}
            />
            <span
              className="mx-4 text-[10px] uppercase tracking-widest"
              style={{ color: "rgba(69,71,76,0.5)" }}
            >
              or email
            </span>
            <div
              className="flex-grow border-t"
              style={{ borderColor: "rgba(198,198,204,0.4)" }}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Your Name</Label>
              <Input
                id="displayName"
                placeholder="Alex Smith"
                {...register("displayName")}
              />
              {errors.displayName && (
                <p className="text-xs" style={{ color: "#ba1a1a" }}>
                  {errors.displayName.message}
                </p>
              )}
            </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="password">Create Password</Label>
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
              {loading ? "Creating account…" : "Create Account"}
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

          <div className="mt-12 text-center space-y-4">
            <p
              className="text-sm"
              style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
            >
              Already have an account?{" "}
              <Link
                href={loginHref}
                className="font-bold hover:underline"
                style={{ color: "#030813" }}
              >
                Log In
              </Link>
            </p>
            <p
              className="text-[11px] uppercase tracking-widest leading-relaxed"
              style={{
                color: "rgba(69,71,76,0.6)",
                fontFamily: "var(--font-grotesk)",
              }}
            >
              By registering, you agree to the Home Base{" "}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function ValueProp({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-6">
      <div
        className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(254,212,136,0.3)", color: "#775a19" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
          {icon}
        </span>
      </div>
      <div>
        <h2
          className="font-caslon text-[24px] leading-8 mb-2"
          style={{ color: "#030813" }}
        >
          {title}
        </h2>
        <p
          className="text-base"
          style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
