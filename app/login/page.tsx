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
import Image from "next/image";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/properties";
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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  const signupHref =
    redirectTo === "/"
      ? "/signup"
      : `/signup?redirect=${encodeURIComponent(redirectTo)}`;

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
            Sign In
          </h1>
          <p className="text-base mb-8" style={{ color: "#45474c" }}>
            Welcome back. Enter your credentials to continue.
          </p>

          {/* Social sign-in */}
          {/* <div className="space-y-3 mb-8">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 border text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-muted/40"
              style={{ borderColor: "#c6c6cc", color: "#1b1c1c", fontFamily: "var(--font-grotesk)" }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 border text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-muted/40"
              style={{ borderColor: "#c6c6cc", color: "#1b1c1c", fontFamily: "var(--font-grotesk)" }}
            >
              <MicrosoftIcon />
              Continue with Microsoft
            </button>
          </div> */}

          {/* <div className="relative flex items-center mb-8">
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
          </div> */}

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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs" style={{ color: "#ba1a1a" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs uppercase tracking-widest hover:underline"
                style={{ color: "#45474c" }}
              >
                Forgot password?
              </Link>
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
              {loading ? "Signing in…" : "Sign In"}
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

          <div className="mt-12 text-center">
            <p
              className="text-sm"
              style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href={signupHref}
                className="font-bold hover:underline"
                style={{ color: "#030813" }}
              >
                Create Account
              </Link>
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

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path d="M1 1h10v10H1z" fill="#f25022" />
      <path d="M13 1h10v10H13z" fill="#7fbb00" />
      <path d="M1 13h10v10H1z" fill="#00a4ef" />
      <path d="M13 13h10v10H13z" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
