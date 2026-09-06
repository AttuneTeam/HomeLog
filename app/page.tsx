import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingWhy } from "@/components/landing/landing-why";
import { LandingHusbok } from "@/components/landing/landing-husbok";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * Public landing page.
 *
 * A server component: only the nav (scroll shrink, mobile disclosure) and the
 * principles accordion opt into the client. Fonts are wired in app/layout.tsx,
 * so nothing here needs to re-declare them.
 *
 * Colours come from the `landing-*` tokens in app/globals.css, which carry both
 * light and dark values. No hex literals belong in this subtree.
 */
export default function LandingPage() {
  return (
    <div className="bg-landing-paper text-landing-fg selection:bg-landing-brass selection:text-landing-on-brass">
      <LandingNav />

      <main>
        <LandingHero />
        <LandingWhy />
        <LandingHusbok />
        <LandingHow />
      </main>

      <LandingFooter />
    </div>
  );
}
