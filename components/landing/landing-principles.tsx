"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * "Our principles" — a single-open accordion, first item open by default.
 *
 * A client component for the open/closed state. Open state is signalled by the
 * +/− affordance and `aria-expanded`, never by colour alone, so it survives both
 * themes and a monochrome display.
 */

const PRINCIPLES = [
  {
    number: "01",
    title: "Care over convenience",
    body: "A home is not a transaction. We make space for the small, important work of looking after one.",
  },
  {
    number: "02",
    title: "Clarity is kindness",
    body: "Good records remove doubt. They let the next owner begin with confidence, not detective work.",
  },
  {
    number: "03",
    title: "Built to be passed on",
    body: "The best things in a house outlast us. Home Base is made to travel, intact, through every chapter.",
  },
] as const;

export function LandingPrinciples() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-landing-paper">
      <div data-observe className="mx-auto grid max-w-[1280px] gap-10 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-16">
        <div>
          <p className="landing-eyebrow text-landing-brass-text">Our principles</p>

          <h2 className="mt-8 font-caslon text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.15] tracking-[-0.015em] text-landing-fg">
            The way we choose to work.
          </h2>
        </div>

        <div className="border-t border-landing-hairline">
          {PRINCIPLES.map(({ number, title, body }, index) => {
            const isOpen = openIndex === index;
            const panelId = `principle-panel-${number}`;
            const buttonId = `principle-trigger-${number}`;

            return (
              <div key={number} className="border-b border-landing-hairline">
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="landing-focus flex w-full items-center gap-6 py-7 text-left"
                  >
                    <span className="font-grotesk text-xs text-landing-brass-text">
                      {number}
                    </span>

                    <span className="flex-1 font-caslon text-xl text-landing-fg md:text-2xl">
                      {title}
                    </span>

                    {isOpen ? (
                      <Minus className="size-5 shrink-0 text-landing-muted" aria-hidden />
                    ) : (
                      <Plus className="size-5 shrink-0 text-landing-muted" aria-hidden />
                    )}
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-8 pl-12 pr-10"
                >
                  <p className="max-w-[52ch] font-grotesk text-base leading-relaxed text-landing-muted">
                    {body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
