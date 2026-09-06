/**
 * "How Home Base works" — four numbered steps, the target of the nav's
 * "How it works" link.
 *
 * Hairline rules divide the steps: vertically between columns from `md` up,
 * horizontally between stacked rows below it. Copy is transcribed verbatim.
 */

const STEPS = [
  {
    number: "01",
    title: "Set the scene",
    body: "Add your property, its history and the people who know it best.",
  },
  {
    number: "02",
    title: "Keep the record",
    body: "Log maintenance, renovations and documents as life happens.",
  },
  {
    number: "03",
    title: "Build confidence",
    body: "See what has been done, when, and by whom — at a glance.",
  },
  {
    number: "04",
    title: "Pass it on",
    body: "Share a complete, useful record at sale or settlement.",
  },
] as const;

export function LandingHow() {
  return (
    // The hairline separates this from the húsbók section above it. Both sit on
    // paper, so without it the two run together — the prototype relied on its dark
    // "Why it matters" band to divide them, and that band was cut.
    <section
      id="how"
      className="scroll-mt-20 border-t border-landing-hairline bg-landing-paper"
    >
      <div data-observe className="mx-auto max-w-[1280px] px-6 py-20 md:px-10 md:py-28 lg:px-16">
        <p className="landing-eyebrow text-landing-brass-text">How Home Base works</p>

        <h2 className="mt-8 max-w-[18ch] font-caslon text-[clamp(2rem,4.2vw,3.5rem)] font-normal leading-[1.14] tracking-[-0.015em] text-landing-fg">
          One calm place for the life of your property.
        </h2>

        <ol className="mt-16 grid border-t border-landing-hairline md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ number, title, body }) => (
            <li
              key={number}
              /* Stacked and two-up, the rules run horizontally under each row;
                 four-up they run vertically between columns. The bottom rule is
                 kept in every case, as in the prototype. */
              className="border-b border-landing-hairline py-8 lg:border-l lg:px-8 lg:py-10 lg:first:border-l-0 lg:first:pl-0"
            >
              <p className="font-grotesk text-xs text-landing-brass-text">{number}</p>

              <h3 className="mt-6 font-caslon text-2xl font-normal leading-tight text-landing-fg">
                {title}
              </h3>

              <p className="mt-4 font-grotesk text-sm leading-relaxed text-landing-muted">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
