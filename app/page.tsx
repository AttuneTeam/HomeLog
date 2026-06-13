"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Libre_Caslon_Text, Hanken_Grotesk } from "next/font/google";

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon-loaded",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const grotesk = Hanken_Grotesk({
  variable: "--font-grotesk-loaded",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
});

export default function LandingPage() {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add("shadow-sm", "!h-16");
        header.classList.remove("h-20");
      } else {
        header.classList.remove("shadow-sm", "!h-16");
        header.classList.add("h-20");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in");
            entry.target.classList.remove("opacity-0");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll("[data-observe]").forEach((el) => {
      el.classList.add("opacity-0");
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`${caslon.variable} ${grotesk.variable} bg-[#fbf9f9] text-[#1b1c1c] selection:bg-[#fed488] selection:text-[#261900]`}
      style={{
        fontFamily: "var(--font-grotesk-loaded, system-ui, sans-serif)",
      }}
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeInUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-gradient {
          background: radial-gradient(circle at top right, rgba(255,222,165,0.15), transparent 60%);
        }
        .label-caps {
          font-family: var(--font-grotesk-loaded, system-ui, sans-serif);
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0.1em;
          font-weight: 600;
          text-transform: uppercase;
        }
        .font-caslon {
          font-family: var(--font-caslon-loaded, 'Georgia', serif);
        }
        .font-grotesk {
          font-family: var(--font-grotesk-loaded, system-ui, sans-serif);
        }
        .ms { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24; }
      `}</style>
      {/* Google Font for Material Symbols */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      />

      {/* ── Nav ── */}
      <header
        ref={headerRef}
        className="w-full top-0 sticky bg-[#fbf9f9] border-b border-[#c6c6cc]/30 z-50 transition-all duration-300 h-20"
      >
        <nav className="max-w-[1280px] mx-auto px-16 flex items-center justify-between h-full">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Home Base"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="font-caslon text-2xl text-[#030813] tracking-tight">
              Home Base
            </span>
          </Link>
          <div className="hidden md:flex items-center space-x-8">
            {/* {["Platform", "Services", "Heritage", "Pricing"].map((item) => (
              <a
                key={item}
                href="#"
                className="font-grotesk text-base text-[#45474c] hover:text-[#030813] transition-colors duration-300"
              >
                {item}
              </a>
            ))} */}
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="font-grotesk text-base text-[#45474c] hover:text-[#030813] transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/login"
              className="bg-[#030813] text-white px-6 py-2.5 label-caps hover:bg-[#1a202c] transition-all active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative h-[calc(100vh-80px)] flex items-center overflow-hidden hero-gradient">
          <div className="max-w-[1280px] mx-auto px-16 w-full grid lg:grid-cols-2 gap-12 items-center py-10">
            <div data-observe className="opacity-0">
              <span className="label-caps text-[#775a19] mb-4 inline-block bg-[#fed488] px-2 py-0.5">
                For properties with nothing to hide
              </span>
              <h1 className="font-caslon text-[48px] leading-[56px] tracking-[-0.02em] text-[#030813] mb-5 max-w-xl">
                Your Property&apos;s Digital Home.
              </h1>
              <p className="font-grotesk text-lg leading-7 text-[#45474c] mb-7 max-w-lg">
                Inspired by the Nordic tradition of the house book, a living
                record that accompanies a property throughout its life: our
                platform reimagines home ownership for the digital age.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="bg-[#030813] text-white px-10 py-4 label-caps hover:bg-[#1a202c] transition-all flex items-center justify-center gap-2"
                >
                  Start for Free
                  <span className="ms text-[18px]">arrow_forward</span>
                </Link>
                {/* <button className="border border-[#76777c] px-10 py-4 label-caps hover:bg-[#e9e8e7] transition-all">
                  Tour the Platform
                </button> */}
              </div>
            </div>
            <div
              data-observe
              className="opacity-0 relative"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="aspect-[4/5] bg-[#f5f3f3] border border-[#c6c6cc]/30 relative overflow-hidden group">
                <Image
                  src="/hero-screen.png"
                  alt="Home Base app screenshot"
                  fill
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                {/* <div className="absolute bottom-8 left-8 right-8 bg-[#fbf9f9]/90 backdrop-blur-md p-6 border border-[#c6c6cc]/20">
                  <p className="label-caps text-[#775a19] mb-2">
                    PROVENANCE REPORT
                  </p>
                  <p className="font-caslon text-2xl text-[#030813]">
                    The Belvedere Estate, 1924
                  </p>
                </div> */}
              </div>
            </div>
          </div>
        </section>

        {/* ── Quality Management ── */}
        <section className="py-20 bg-[#fbf9f9]">
          <div className="max-w-[1280px] mx-auto px-16">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div data-observe className="opacity-0 order-2 md:order-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-8 border border-[#c6c6cc]/20 aspect-square flex flex-col justify-between">
                    <span className="ms text-[#775a19] text-4xl">
                      account_balance_wallet
                    </span>
                    <div>
                      <h3 className="font-caslon text-2xl text-[#030813] mb-2">
                        Automated Tracking
                      </h3>
                      <p className="font-grotesk text-base text-[#45474c]">
                        Real-time expense categorization for complex portfolios.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-8 border border-[#c6c6cc]/20 aspect-square flex flex-col justify-between">
                    <span className="ms text-[#775a19] text-4xl">
                      receipt_long
                    </span>
                    <div>
                      <h3 className="font-caslon text-2xl text-[#030813] mb-2">
                        Tax-Ready
                      </h3>
                      <p className="font-grotesk text-base text-[#45474c]">
                        Instant exports formatted for professional accounting
                        standards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div data-observe className="opacity-0 order-1 md:order-2">
                <h2 className="font-caslon text-[32px] leading-10 text-[#030813] mb-6">
                  Quality Management
                </h2>
                <p className="font-grotesk text-lg text-[#45474c] mb-8 leading-relaxed">
                  Managing an investment shouldn&apos;t be a second job. Home
                  Base provides a simple tool to log every detail, from routine
                  maintenance to major value-add renovations building a smart
                  ledger for your property.
                </p>
                <ul className="space-y-4">
                  {[
                    "Smart receipt capture and digital filing",
                    "Seamless rent and expense sycning",
                    "Monthly cash-flow performance view",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-4 border-b border-[#c6c6cc]/20 pb-4"
                    >
                      <span
                        className="ms text-[#030813]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-grotesk text-base">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Renovation Ledger (Bento) ── */}
        <section className="py-20 bg-[#f5f3f3] overflow-hidden">
          <div className="max-w-[1280px] mx-auto px-16">
            <div data-observe className="opacity-0 text-center mb-16">
              <h2 className="font-caslon text-[48px] leading-[56px] tracking-[-0.02em] text-[#030813] mb-4">
                The Home Passport
              </h2>
              <p className="font-grotesk text-lg text-[#45474c] max-w-2xl mx-auto">
                Document the improvements, maintenance, and professionals that
                grow your assets value compiled into a beautiful transferable
                ledger
              </p>
            </div>
            <div
              data-observe
              className="opacity-0 grid grid-cols-1 md:grid-cols-12 gap-6"
            >
              {/* Hero bento */}
              <div className="md:col-span-8 group relative h-[400px] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80"
                  alt="Architectural details — oak, marble, brass"
                  className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030813]/80 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 text-white">
                  <span className="label-caps text-[#e9c176] mb-2 block">
                    PROFESSIONAL NETWORK
                  </span>
                  <h3 className="font-caslon text-[32px] leading-10">
                    Buiding your Network
                  </h3>
                </div>
              </div>
              {/* Timeline bento */}
              <div className="md:col-span-4 bg-white p-8 border border-[#c6c6cc]/30 flex flex-col justify-center">
                <h4 className="label-caps text-[#775a19] mb-4">
                  Property Lifecycle
                </h4>
                <div className="space-y-6">
                  <div className="border-l-2 border-[#775a19] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      OCT 2023
                    </p>
                    <p className="font-grotesk font-semibold text-base">
                      Energy Efficiency Upgrade
                    </p>
                  </div>
                  <div className="border-l-2 border-[#76777c] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      JAN 2024
                    </p>
                    <p className="font-grotesk text-base">
                      Scheduled Pest inspection
                    </p>
                  </div>
                  <div className="border-l-2 border-[#76777c] pl-6 opacity-50">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      EST. JUN 2024
                    </p>
                    <p className="font-grotesk text-base text-[#45474c]">
                      Exterior Repainting
                    </p>
                  </div>
                </div>
              </div>
              {/* Sharing bento */}
              <div className="md:col-span-8 bg-[#e3e2e2] h-[300px] overflow-hidden flex">
                <div className="w-1/2 p-8 flex flex-col justify-center">
                  <h4 className="font-caslon text-2xl text-[#030813] mb-4">
                    Investment Insights
                  </h4>
                  <p className="font-grotesk text-base text-[#45474c]">
                    Export a comprehensive &lsquo;Property Bio&rsquo; to share
                    with banks, insurers or potential buyers. Beatifully
                    designed it enhances your sale listing making your property
                    stand out from the rest.
                  </p>
                </div>
                <div className="w-1/2 relative">
                  <img
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                    alt="Elegant workspace with laptop and notebook"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Seamless Integrations ── */}
        <section className="py-20 bg-[#fbf9f9]">
          <div className="max-w-[1280px] mx-auto px-16 text-center">
            <div data-observe className="opacity-0">
              <div className="inline-flex items-center gap-2 bg-[#775a19]/10 text-[#775a19] px-4 py-1 rounded-full mb-8">
                <span
                  className="ms text-[16px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                <span className="label-caps">Secured Ecosystem</span>
              </div>
              <h2 className="font-caslon text-[32px] leading-10 text-[#030813] mb-6">
                Seamless Integrations
              </h2>
              <p className="font-grotesk text-lg text-[#45474c] max-w-2xl mx-auto mb-16">
                Connect with the institutions that power your financial life.
                Stop chasing receipts and let your financial data work for you.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center opacity-60">
                {[
                  { name: "MyGov", label: "DIRECT SYNC" },
                  { name: "Xero", label: "API PARTNER" },
                  { name: "ATO", label: "COMPLIANT" },
                  { name: "QuickBooks", label: "NATIVE EXPORT" },
                ].map(({ name, label }) => (
                  <div key={name} className="flex flex-col items-center gap-4">
                    <div className="h-12 w-32 bg-[#45474c]/10 rounded flex items-center justify-center font-bold text-lg font-grotesk">
                      {name}
                    </div>
                    <p className="label-caps text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Future of Property Value ── */}
        <section className="relative min-h-[60vh] flex items-center bg-[#030813] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <Image
              src="/federation-house.jpg"
              alt="Federation brick house at dusk with warm interior lighting"
              fill
              className="object-cover"
            />
          </div>
          <div className="max-w-[1280px] mx-auto px-16 relative z-10 grid lg:grid-cols-2 gap-16 py-20">
            <div data-observe className="opacity-0">
              <h2 className="font-caslon text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] mb-8">
                The Future of Your Asset
              </h2>
              <p className="font-grotesk text-lg text-white/80 mb-8 leading-relaxed">
                Data shows that properties with a documented history appreciate
                significantly faster. By building your ledger today, you are
                securing your return tomorrow.
              </p>
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-8">
                <div className="flex items-center gap-6 mb-4">
                  <span className="text-4xl font-caslon text-[#e9c176]">
                    15%
                  </span>
                  <p className="label-caps">
                    AVERAGE APPRECIATION PREMIUM FOR DOCUMENTED ESTATES
                  </p>
                </div>
                <p className="font-grotesk text-base italic text-white/60">
                  Source: Investment Property Index, 2024
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20 bg-[#fbf9f9]">
          <div className="max-w-[1280px] mx-auto px-16 text-center">
            <div
              data-observe
              className="opacity-0 max-w-3xl mx-auto py-16 border border-[#c6c6cc]/30 bg-white"
            >
              <h2 className="font-caslon text-[32px] leading-10 text-[#030813] mb-4">
                Ready to Simplify Your Management?
              </h2>
              <p className="font-grotesk text-lg text-[#45474c] mb-10">
                Join thousands of property owners managing over $1.2B in
                investment assets.
              </p>
              <Link
                href="/login"
                className="inline-block bg-[#030813] text-white px-12 py-5 label-caps hover:bg-[#775a19] hover:text-white transition-all scale-110"
              >
                Start for Free
              </Link>
              <p className="mt-8 label-caps text-[10px] text-[#45474c] opacity-60">
                NO CREDIT CARD REQUIRED. FULL ACCESS FOR A LIMITED TIME.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-[#f5f3f3] border-t border-[#c6c6cc]/20">
        <div className="max-w-[1280px] mx-auto px-16 py-20 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Home Base"
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="font-caslon text-2xl text-[#030813]">
                Home Base
              </span>
            </div>
            <p className="font-grotesk text-sm text-[#45474c] text-center md:text-left">
              © 2024 Home Base. Modern Heritage &amp; Property Stewardship.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Accounting Integration", href: "#" },
              { label: "Contact Support", href: "#" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="font-grotesk text-sm text-[#45474c] hover:text-[#775a19] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
