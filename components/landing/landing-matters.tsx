/**
 * "Why it matters" — the slab.
 *
 * The page's only dark band in light theme, and the one band that inverts in dark:
 * `--landing-slab` sits 0.850 BELOW paper in light and 0.105 ABOVE it in dark, so it
 * reads as a raised surface rather than a hole. See the token block in globals.css.
 *
 * The prototype's statistics row (2,400+ properties, 87 suburbs, 4.8/5) is
 * deliberately omitted: those figures are invented, and the page is read by the
 * accountants the product depends on. Only the statement ships.
 */
export function LandingMatters() {
  return (
    <section className="bg-landing-slab text-landing-on-slab">
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-10 md:py-32 lg:px-16">
        <p className="landing-eyebrow text-landing-brass-on-slab">Why it matters</p>

        <h2 className="mt-10 font-caslon text-[clamp(2.25rem,5vw,4.25rem)] font-normal leading-[1.14] tracking-[-0.015em]">
          The details are small.
          <span className="block italic text-landing-brass-on-slab">
            The difference is lasting.
          </span>
        </h2>
      </div>
    </section>
  );
}
