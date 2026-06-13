import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — Home Base",
  description:
    "The terms and conditions that govern your use of the Home Base application.",
};

const CONTACT_EMAIL = "raulfelixcarrizo@gmail.com";
const LAST_UPDATED = "13 June 2026";

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use
        of the Home Base property-investment tracking application and related
        services (the &ldquo;Service&rdquo;) provided by Home Base
        (&ldquo;Home Base&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;). By creating an account or using the Service, you agree
        to these Terms.
      </p>

      <LegalSection heading="1. Eligibility and accounts">
        <p>
          You must be at least 18 years old and able to form a binding contract to
          use the Service. You are responsible for the information you provide, for
          maintaining the confidentiality of your account credentials, and for all
          activity that occurs under your account. You may sign in using an email
          and password or through Google. Notify us promptly of any unauthorised
          use of your account.
        </p>
      </LegalSection>

      <LegalSection heading="2. The Service">
        <p>
          Home Base helps you track properties, renovations, expenses, loans, and
          rental income, and provides AI-assisted tools that extract data from
          documents and suggest classifications against Australian Taxation Office
          (ATO) guidance. We may add, change, or remove features at any time.
        </p>
      </LegalSection>

      <LegalSection heading="3. Not financial, tax, or legal advice">
        <p>
          The Service, including any AI-generated classifications, summaries, or
          estimates, is provided for general informational purposes only and does
          not constitute financial, tax, accounting, or legal advice. AI outputs
          may be inaccurate or incomplete. You are responsible for verifying all
          information and should consult a qualified professional and the ATO
          before making decisions or lodging tax returns.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your content">
        <p>
          You retain ownership of the data, documents, and other content you submit
          to the Service (&ldquo;Your Content&rdquo;). You grant us a limited
          licence to host, store, process, and display Your Content solely to
          operate and improve the Service for you. You are responsible for ensuring
          you have the rights to submit Your Content and that it does not violate
          any law or third-party rights.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Use the Service for any unlawful or fraudulent purpose;</li>
          <li>Attempt to access accounts or data that are not yours;</li>
          <li>
            Interfere with, disrupt, reverse-engineer, or attempt to gain
            unauthorised access to the Service or its underlying systems;
          </li>
          <li>Upload malware or content that infringes the rights of others.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Third-party services">
        <p>
          The Service integrates with third-party services such as Google, Xero,
          and others. Your use of those services is governed by their own terms and
          privacy policies, and we are not responsible for them.
        </p>
      </LegalSection>

      <LegalSection heading="7. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate your access if you breach these Terms or if we
          reasonably believe your use poses a risk to the Service or others. Upon
          termination, your right to use the Service ceases, and we will handle
          your data as described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and limitation of liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, to the maximum extent
          permitted by law. Nothing in these Terms excludes, restricts, or modifies
          any consumer guarantee, right, or remedy that cannot lawfully be excluded
          under the Australian Consumer Law. To the extent permitted by law, our
          liability for any claim arising out of or relating to the Service is
          limited to resupplying the Service or paying the cost of having it
          resupplied.
        </p>
      </LegalSection>

      <LegalSection heading="9. Governing law">
        <p>
          These Terms are governed by the laws of New South Wales, Australia, and
          you submit to the non-exclusive jurisdiction of the courts of New South
          Wales.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. We will post the updated
          version on this page and revise the &ldquo;Last updated&rdquo; date
          above. Your continued use of the Service after changes take effect
          constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about these Terms can be sent to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline"
            style={{ color: "#030813" }}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
