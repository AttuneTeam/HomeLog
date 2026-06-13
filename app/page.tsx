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
                Your Property&apos;s Home Passport.
              </h1>
              <p className="font-grotesk text-lg leading-7 text-[#45474c] mb-7 max-w-lg">
                Inspired by the Nordic tradition of the <i>house book</i>, build
                a living record that accompanies a property throughout its life.
                Home Base provides a simple tool to log every detail, from
                routine maintenance to major value-add renovations building a
                smart ledger for your property.
              </p>
              <p className="font-grotesk text-lg leading-7 text-[#45474c] mb-7 max-w-lg">
                Our platform reimagines home ownership for the digital age and
                supports you on your renovation journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="bg-[#030813] text-white px-10 py-4 label-caps hover:bg-[#1a202c] transition-all flex items-center justify-center gap-2"
                >
                  Start for Free
                  <span className="ms text-[18px]">arrow_forward</span>
                </Link>
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

        {/* ── Build your Base through Quality Management ── */}
        <section className="py-20 bg-[#f0eeec]">
          <div className="max-w-[1280px] mx-auto px-16">
            <div data-observe className="opacity-0 text-center mb-16">
              <h2 className="font-caslon text-[40px] leading-[48px] tracking-[-0.02em] text-[#030813] mb-4">
                Build your Base through Quality Management
              </h2>
              <p className="font-grotesk text-lg text-[#45474c] max-w-2xl mx-auto">
                Managing an investment shouldn&apos;t be a second job. Home Base
                gives you the tools to plan renovations, track every cost, and
                stay tax-ready — all in one place.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div data-observe className="opacity-0 order-2 md:order-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-8 border border-[#c6c6cc]/20 aspect-square flex flex-col justify-between">
                    <span className="ms text-[#775a19] text-4xl">
                      construction
                    </span>
                    <div>
                      <h3 className="font-caslon text-2xl text-[#030813] mb-2">
                        Renovation Planning
                      </h3>
                      <p className="font-grotesk text-base text-[#45474c]">
                        Scope, schedule, and track every project from quote to
                        completion.
                      </p>
                    </div>
                  </div>
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
                  <div className="bg-white p-8 border border-[#c6c6cc]/20 col-span-2 flex flex-col sm:flex-row items-start gap-6">
                    <span className="ms text-[#775a19] text-4xl shrink-0">
                      receipt_long
                    </span>
                    <div>
                      <h3 className="font-caslon text-2xl text-[#030813] mb-2">
                        Tax-Ready
                      </h3>
                      <p className="font-grotesk text-base text-[#45474c]">
                        AI-powered classification against ATO rulings — instant
                        exports formatted for professional accounting standards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div data-observe className="opacity-0 order-1 md:order-2">
                <span className="label-caps text-[#775a19] mb-4 inline-block">
                  Quality Management
                </span>
                <p className="font-grotesk text-lg text-[#45474c] mb-8 leading-relaxed">
                  From scoping a kitchen reno to filing your tax return, Home
                  Base builds a smart ledger that grows with your property —
                  capturing every detail, receipt, and milestone along the way.
                </p>
                <ul className="space-y-4">
                  {[
                    "Smart receipt capture and digital filing",
                    "Renovation projects with contractor management",
                    "Seamless rent and expense syncing",
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
                Your &ldquo;base&rdquo; is a beautiful, data-rich shareable
                asset showcasing every improvement you&apos;ve made. Add it to
                your sales listing or share your expertise with others on the
                platform.
              </p>
            </div>
            <div
              data-observe
              className="opacity-0 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_auto] md:items-start gap-6"
            >
              {/* Investment Insights bento — moved up */}
              <div className="md:col-span-8 md:col-start-1 md:row-start-1 bg-[#e3e2e2] overflow-hidden flex flex-col sm:flex-row">
                <div className="sm:w-1/2 p-8 flex flex-col justify-center">
                  <h4 className="font-caslon text-2xl text-[#030813] mb-4">
                    Investment Insights
                  </h4>
                  <p className="font-grotesk text-base text-[#45474c]">
                    Export a comprehensive &lsquo;Property Bio&rsquo; to share
                    with banks, insurers, or potential buyers. Beautifully
                    designed, it enhances your sale listing and makes your
                    property stand out from the rest.
                  </p>
                </div>
                {/* Listing mockup — illustrative realestate.com / Domain card */}
                <div className="sm:w-1/2 p-6 flex items-center">
                  <div className="w-full bg-white border border-[#c6c6cc]/30 overflow-hidden flex flex-col shadow-sm">
                    <div className="relative h-[120px] bg-gradient-to-br from-[#dcd6cb] to-[#b9a88c]">
                      <img
                        src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80"
                        alt="Listing exterior"
                        className="w-full h-full object-cover"
                      />
                      {/* Home Base verified badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm">
                        <span
                          className="ms text-[#1a7a4a] text-[16px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          verified
                        </span>
                        <span className="label-caps text-[9px] text-[#030813]">
                          Home Base Verified
                        </span>
                      </div>
                      <span className="absolute bottom-3 right-3 label-caps text-[9px] text-white bg-[#030813]/70 px-2 py-0.5 rounded">
                        For Sale
                      </span>
                    </div>
                    <div className="p-5 flex flex-col gap-3 grow">
                      <div>
                        <p className="font-caslon text-xl text-[#030813]">
                          $1,150,000
                        </p>
                        <p className="font-grotesk text-[13px] text-[#45474c]">
                          14 Belmore St, Hawthorn VIC
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-[#45474c] border-y border-[#c6c6cc]/30 py-2">
                        {[
                          { icon: "bed", n: "4" },
                          { icon: "bathtub", n: "2" },
                          { icon: "directions_car", n: "2" },
                        ].map(({ icon, n }) => (
                          <span
                            key={icon}
                            className="flex items-center gap-1 font-grotesk text-sm"
                          >
                            <span className="ms text-[18px]">{icon}</span>
                            {n}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {[
                          "Full renovation history",
                          "Verified expenses & receipts",
                          "Energy & maintenance records",
                        ].map((use) => (
                          <span
                            key={use}
                            className="flex items-center gap-2 font-grotesk text-[12px] text-[#45474c]"
                          >
                            <span
                              className="ms text-[#1a7a4a] text-[14px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check_circle
                            </span>
                            {use}
                          </span>
                        ))}
                      </div>
                      <button className="mt-auto label-caps text-[10px] text-white bg-[#030813] py-2 rounded hover:bg-[#1a202c] transition-colors">
                        View Home Passport
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Timeline bento — spans both rows on the right */}
              <div className="md:col-span-4 md:col-start-9 md:row-start-1 md:row-span-2 bg-white p-8 border border-[#c6c6cc]/30 flex flex-col justify-center">
                <h4 className="label-caps text-[#775a19] mb-4">
                  Rich Property Timeline
                </h4>
                <div className="space-y-6">
                  <div className="border-l-2 border-[#775a19] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      MAR 2021
                    </p>
                    <p className="font-grotesk font-semibold text-base">
                      Property Purchased
                    </p>
                    <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
                      Settled at $845,000
                    </p>
                  </div>
                  <div className="border-l-2 border-[#76777c] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      AUG 2022
                    </p>
                    <p className="font-grotesk text-base">Kitchen Renovation</p>
                    <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
                      New cabinetry, stone benchtops &amp; appliances
                    </p>
                  </div>
                  <div className="border-l-2 border-[#76777c] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      OCT 2023
                    </p>
                    <p className="font-grotesk text-base">
                      Energy Efficiency Upgrade
                    </p>
                    <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
                      6.6kW solar &amp; ducted heat pump
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
                  <div className="border-l-2 border-[#76777c] pl-6">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      MAR 2024
                    </p>
                    <p className="font-grotesk text-base">Bathroom Remodel</p>
                    <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
                      Full ensuite refit with underfloor heating
                    </p>
                  </div>
                  <div className="border-l-2 border-[#76777c] pl-6 opacity-50">
                    <p className="label-caps text-[10px] text-[#45474c]">
                      EST. JUN 2024
                    </p>
                    <p className="font-grotesk text-base text-[#45474c]">
                      Exterior Repainting
                    </p>
                    <p className="font-grotesk text-[13px] text-[#76777c] mt-0.5">
                      Dulux Weathershield — Monument
                    </p>
                  </div>
                </div>
                {/* Shareable QR (illustrative) */}
                <div className="mt-8 pt-6 border-t border-[#c6c6cc]/30 flex items-center gap-4">
                  <svg
                    viewBox="0 0 25 25"
                    className="w-16 h-16 shrink-0"
                    shapeRendering="crispEdges"
                    role="img"
                    aria-label="QR code to view this property's timeline"
                  >
                    <rect width="25" height="25" fill="#fbf9f9" />
                    {(() => {
                      const rects: React.ReactNode[] = [];
                      // Three finder patterns (corners)
                      const finder = (ox: number, oy: number) => (
                        <g key={`f-${ox}-${oy}`} fill="#030813">
                          <rect x={ox} y={oy} width={7} height={1} />
                          <rect x={ox} y={oy + 6} width={7} height={1} />
                          <rect x={ox} y={oy} width={1} height={7} />
                          <rect x={ox + 6} y={oy} width={1} height={7} />
                          <rect x={ox + 2} y={oy + 2} width={3} height={3} />
                        </g>
                      );
                      rects.push(finder(0, 0));
                      rects.push(finder(18, 0));
                      rects.push(finder(0, 18));
                      // Deterministic pseudo-random data modules
                      const inFinder = (x: number, y: number) =>
                        (x < 8 && y < 8) ||
                        (x > 16 && y < 8) ||
                        (x < 8 && y > 16);
                      let seed = 7;
                      for (let y = 0; y < 25; y++) {
                        for (let x = 0; x < 25; x++) {
                          if (inFinder(x, y)) continue;
                          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                          if ((seed >> 8) % 100 < 42) {
                            rects.push(
                              <rect
                                key={`d-${x}-${y}`}
                                x={x}
                                y={y}
                                width={1}
                                height={1}
                                fill="#030813"
                              />,
                            );
                          }
                        }
                      }
                      return rects;
                    })()}
                  </svg>
                  <div>
                    <p className="label-caps text-[10px] text-[#775a19] mb-1">
                      Scan to View
                    </p>
                    <p className="font-grotesk text-[13px] text-[#45474c] leading-snug">
                      Share a live, read-only Home Passport with buyers and
                      agents.
                    </p>
                  </div>
                </div>
              </div>
              {/* Building your Network bento — moved down */}
              <div className="md:col-span-8 md:col-start-1 md:row-start-2 group relative h-[300px] overflow-hidden">
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
                    Building your Network
                  </h3>
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
              © 2026 Home Base. Modern Digital Property Stewardship.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
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
