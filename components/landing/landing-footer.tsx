import Link from "next/link";
import Image from "next/image";

/**
 * Landing footer.
 *
 * Keeps the existing page's light ground and hairline top border rather than the
 * prototype's ink band (owner decision, Phase 1 checkpoint). It is light in light
 * theme and dark in dark theme, the same as paper, so it uses the paper-ground
 * text tokens.
 *
 * The Privacy and Terms links are not in the prototype but are carried over from
 * the page this replaces: both routes exist, and this is the only public page that
 * links to them.
 */

const LEGAL_LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
] as const;

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-landing-hairline bg-landing-footer">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-8 px-6 py-16 md:flex-row md:items-center md:justify-between md:px-10 md:py-20 lg:px-16">
        <Link href="/" className="landing-focus" aria-label="Home Base — home">
          <Image
            src="/logo.png"
            alt="Home Base"
            width={40}
            height={40}
            className="h-8 w-auto object-contain dark:brightness-0 dark:invert"
          />
        </Link>

        <p className="order-last font-grotesk text-sm text-landing-muted md:order-none">
          A property&rsquo;s home passport. Made in Australia.
        </p>

        <div className="flex flex-col items-center gap-4 md:items-end">
          <p className="landing-eyebrow text-landing-brass-text">
            Founded 2021 / Sydney + Melbourne
          </p>

          <div className="flex gap-6">
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="landing-focus font-grotesk text-sm text-landing-muted transition-colors hover:text-landing-fg"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
