import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Closing call to action.
 *
 * With the "Why it matters" band removed, this brass slab is the only saturated
 * colour on the page, so it carries the whole visual close. Ink text on brass in
 * both themes; brass itself dims from 0.699 to 0.600 in dark so the band does not
 * glare against a near-black page.
 */
export function LandingCta() {
  return (
    <section id="start" className="scroll-mt-20 bg-landing-brass text-landing-on-brass">
      <div data-observe className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32 lg:px-16">
        <p className="landing-eyebrow opacity-70">A better record starts here</p>

        <h2 className="mt-10 max-w-[16ch] font-caslon text-[clamp(2.5rem,5.6vw,4.75rem)] font-normal leading-[1.08] tracking-[-0.02em]">
          Give your home a story worth passing on.
        </h2>

        <Link
          href="/signup"
          className="landing-focus landing-eyebrow group mt-14 inline-flex items-center gap-3 bg-landing-fg px-10 py-5 text-landing-paper transition-opacity hover:opacity-90 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          Start for free
          <ArrowUpRight
            className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
