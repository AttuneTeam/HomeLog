"use client";

import { useEffect } from "react";

/**
 * Fade-in-on-scroll for anything marked `data-observe`.
 *
 * Renders nothing. Two deliberate properties:
 *
 * 1. The hidden state is applied by JavaScript, not by the server. Markup ships
 *    visible, so a reader without JavaScript sees the whole page rather than a
 *    blank one — the failure mode of doing this the other way round.
 * 2. It bails entirely under `prefers-reduced-motion`, leaving the markup
 *    untouched rather than animating quickly.
 */
export function LandingReveal() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    if (prefersReducedMotion.matches) return;

    const targets = document.querySelectorAll<HTMLElement>("[data-observe]");
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("landing-reveal");
          entry.target.classList.add("landing-reveal-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 },
    );

    for (const target of targets) {
      target.classList.add("landing-reveal");
      observer.observe(target);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
