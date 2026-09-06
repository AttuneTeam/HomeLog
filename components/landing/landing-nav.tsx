"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky landing-page navigation.
 *
 * A client component only because it shrinks on scroll and owns the mobile
 * disclosure; the rest of the landing page renders on the server.
 *
 * The prototype's "The people" link is deliberately absent — the section it
 * targets is excluded from this rebuild.
 */

const SECTION_LINKS = [
  { label: "Our story", href: "#story" },
  { label: "How it works", href: "#how" },
] as const;

export function LandingNav() {
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const onScroll = () => {
      header.dataset.scrolled = window.scrollY > 20 ? "true" : "false";
    };
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on Escape so it is dismissible without a pointer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      data-scrolled="false"
      className={cn(
        "group/header sticky top-0 z-50 w-full",
        "bg-landing-paper border-b border-landing-hairline",
        "data-[scrolled=true]:shadow-sm",
        "transition-shadow duration-300 motion-reduce:transition-none",
      )}
    >
      {/*
       * The scroll shrink lives on the nav row, not the header. A fixed height on
       * the header would leave the mobile panel below no room to occupy, so the
       * header grows with its contents and only the row animates.
       */}
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex max-w-[1280px] items-center justify-between px-6 md:px-10 lg:px-16",
          "h-20 group-data-[scrolled=true]/header:h-16",
          "transition-[height] duration-300 motion-reduce:transition-none",
        )}
      >
        <Link href="/" className="flex items-center" aria-label="Home Base — home">
          <Image
            src="/logo.png"
            alt="Home Base"
            width={40}
            height={40}
            priority
            /* The mark is dark ink on transparent, so it disappears on the dark
               theme's near-black ground. Force it to white there, as the prototype
               does for the same file. */
            className="h-9 w-auto object-contain dark:brightness-0 dark:invert"
          />
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {SECTION_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="landing-eyebrow text-landing-fg/80 transition-colors hover:text-landing-fg"
            >
              {label}
            </a>
          ))}

          <Link
            href="/login"
            className="font-grotesk text-sm text-landing-muted transition-colors hover:text-landing-fg"
          >
            Log In
          </Link>

          <Link
            href="/signup"
            className="landing-eyebrow bg-landing-fg px-6 py-3 text-landing-paper transition-opacity hover:opacity-90 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          className="-mr-2 p-2 text-landing-fg md:hidden"
        >
          {menuOpen ? (
            <X className="size-6" aria-hidden />
          ) : (
            <Menu className="size-6" aria-hidden />
          )}
        </button>
      </nav>

      <div
        id="landing-mobile-menu"
        hidden={!menuOpen}
        className="border-t border-landing-hairline bg-landing-paper md:hidden"
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {SECTION_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="landing-eyebrow py-3 text-landing-fg/80"
            >
              {label}
            </a>
          ))}

          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="border-t border-landing-hairline py-3 font-grotesk text-sm text-landing-muted"
          >
            Log In
          </Link>

          <Link
            href="/signup"
            onClick={() => setMenuOpen(false)}
            className="landing-eyebrow mt-2 bg-landing-fg px-6 py-4 text-center text-landing-paper"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
