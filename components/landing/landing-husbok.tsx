/**
 * "The Nordic húsbók" — the origin story for the product's central metaphor.
 *
 * The heading sets *húsbók* in italic on its own line, over a short brass rule,
 * as in the prototype. Copy is transcribed verbatim.
 */
export function LandingHusbok() {
  return (
    <section className="bg-landing-paper">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-16">
        <div>
          <p className="landing-eyebrow text-landing-brass-text">
            A tradition worth keeping
          </p>

          <h2 className="mt-8 font-caslon text-[clamp(2.25rem,4.4vw,3.75rem)] font-normal leading-[1.1] tracking-[-0.015em] text-landing-fg">
            The Nordic
            <span className="block italic">h&uacute;sb&oacute;k</span>
          </h2>

          <hr className="mt-10 w-20 border-0 border-t border-landing-brass" />
        </div>

        <div className="space-y-6 text-landing-muted lg:pt-14">
          <p className="font-grotesk text-xl leading-snug text-landing-fg md:text-2xl">
            In Scandinavia, a house book has long been part of the life of a well-kept
            home.
          </p>
          <p className="font-grotesk text-base leading-relaxed md:text-lg">
            It holds the practical knowledge that otherwise lives in one person&rsquo;s
            head: when the roof was repaired, which paint is on the hallway walls, where
            the water shuts off. More than a ledger, it is an act of stewardship &mdash;
            a promise that the house will be understood and cared for.
          </p>
          <p className="font-grotesk text-base leading-relaxed md:text-lg">
            We borrowed the idea, then made it useful for Australian homes. A digital
            house book that is as considered as the homes it records.
          </p>
        </div>
      </div>
    </section>
  );
}
