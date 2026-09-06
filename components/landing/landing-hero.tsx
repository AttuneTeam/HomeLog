import Image from "next/image";
import { ArrowDown } from "lucide-react";

/**
 * Landing hero. A server component — nothing here is interactive.
 *
 * The photograph is served from public/ rather than a CDN so the public page
 * makes no third-party image request (FR10).
 */
export function LandingHero() {
  return (
    <section className="bg-landing-paper">
      {/* The text column is deliberately wider than the image column, as in the
          prototype — the display type needs the measure to break into three lines
          rather than four. */}
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:px-16">
        <div data-observe>
          <p className="landing-eyebrow text-landing-brass-text">
            About Home Base / 2021&mdash;present
          </p>

          <h1 className="mt-8 font-caslon text-[clamp(2.5rem,6.2vw,5rem)] font-normal leading-[1.08] tracking-[-0.02em] text-landing-fg">
            A home is more than the{" "}
            <em className="italic text-landing-brass-text">sum</em> of its rooms.
          </h1>

          <p className="mt-8 max-w-[46ch] font-grotesk text-lg leading-relaxed text-landing-muted">
            It is the work you put into it. The decisions made quietly, over years.
            Home Base is a place to keep that story &mdash; clear, useful and ready
            for whoever comes next.
          </p>

          <a
            href="#story"
            className="landing-eyebrow group mt-12 inline-flex items-center gap-3 border-b border-landing-fg pb-3 text-landing-fg"
          >
            Read our story
            <ArrowDown
              className="size-4 transition-transform duration-300 group-hover:translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
              aria-hidden
            />
          </a>
        </div>

        <div data-observe className="relative">
          <Image
            src="/house-journal.jpg"
            alt="A Home Base property journal on a timber desk"
            width={1024}
            height={1024}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full object-cover"
          />

          <p className="landing-eyebrow absolute bottom-6 left-6 bg-landing-paper px-5 py-4 text-landing-fg md:bottom-8 md:left-8">
            The house book, reimagined
          </p>
        </div>
      </div>
    </section>
  );
}
