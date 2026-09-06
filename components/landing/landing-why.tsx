/**
 * "Why we exist" — the warm-paper band, and the target of the nav's "Our story"
 * link and the hero's "Read our story" affordance.
 *
 * Copy is transcribed verbatim from the design prototype.
 */
export function LandingWhy() {
  return (
    <section id="story" className="scroll-mt-20 bg-landing-warm">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-16">
        <div>
          <p className="landing-eyebrow text-landing-brass-text">Why we exist</p>

          <h2 className="mt-8 font-caslon text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.15] tracking-[-0.015em] text-landing-fg">
            The handover should feel like a beginning, not an interrogation.
          </h2>
        </div>

        <div className="space-y-6 font-grotesk text-base leading-relaxed text-landing-muted md:text-lg lg:pt-14">
          <p>
            We kept hearing the same story: a new owner arrives with a folder of
            invoices, a handful of half-remembered answers, and a long list of things
            they wish they had asked. Important knowledge disappears between owners.
          </p>
          <p>
            Home Base began as a simple question: what if every property had a living
            record? Not a compliance file, but a generous, honest account of the care
            that has gone into it.
          </p>
          <p>
            We built the tool we wanted to receive ourselves &mdash; a quiet place for
            the facts, the photographs and the little decisions that make a house a
            home.
          </p>
        </div>
      </div>
    </section>
  );
}
