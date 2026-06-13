import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Home Base",
  description:
    "How Home Base collects, uses, stores, and protects your personal and financial information.",
};

const CONTACT_EMAIL = "raulfelixcarrizo@gmail.com";
const LAST_UPDATED = "13 June 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy explains how Home Base (&ldquo;Home Base&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses,
        discloses, and protects your personal information when you use our
        property-investment tracking application and related services (the
        &ldquo;Service&rdquo;). We handle personal information in accordance with
        the Australian Privacy Principles (APPs) set out in the Privacy Act 1988
        (Cth).
      </p>

      <LegalSection heading="1. Information we collect">
        <p>We collect the following categories of information:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Account information.</strong> When you create an account we
            collect your name, email address, and a password (or, if you sign in
            with Google, a unique identifier and the basic profile information
            Google provides — see &ldquo;Signing in with Google&rdquo; below).
          </li>
          <li>
            <strong>Property and financial data.</strong> Information you enter or
            upload about your properties, renovations, expenses, loans, and rental
            income, including invoices, receipts, and statements.
          </li>
          <li>
            <strong>Connected-service data.</strong> If you connect a third-party
            service such as Xero, we access and store the data you authorise (for
            example, accounting categories and exported expenses).
          </li>
          <li>
            <strong>Technical data.</strong> Log data, device and browser
            information, and cookies necessary to keep you signed in and to operate
            the Service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Signing in with Google">
        <p>
          If you choose to sign in with Google, we receive your name, email
          address, and Google account identifier through Google&rsquo;s OAuth
          service. We use this information solely to create and authenticate your
          Home Base account. If you already have a Home Base account with the same
          verified email address, your Google sign-in is linked to that existing
          account so you can use either method. We do not receive your Google
          password, and our use of information received from Google APIs adheres to
          the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="underline"
            style={{ color: "#030813" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide, maintain, and improve the Service;</li>
          <li>To authenticate you and keep your account secure;</li>
          <li>
            To process and classify your expenses and invoices, including using
            artificial-intelligence services to extract data from documents and
            suggest tax classifications against Australian Taxation Office (ATO)
            guidance;
          </li>
          <li>To send you transactional messages such as invitations and password resets;</li>
          <li>To comply with our legal obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. AI processing of your data">
        <p>
          Home Base uses third-party AI providers (including Anthropic and OpenAI)
          to read uploaded documents, generate embeddings, and classify expenses.
          Document content is transmitted to these providers only to perform these
          functions. We do not permit your content to be used to train third-party
          models, and AI outputs are suggestions that you remain responsible for
          reviewing.
        </p>
      </LegalSection>

      <LegalSection heading="5. How we store and protect your information">
        <p>
          Your data is stored using Supabase (Postgres database and object
          storage) and is protected by row-level security so that you can only
          access your own data and data shared with you. We use industry-standard
          measures to protect personal information, but no method of transmission
          or storage is completely secure.
        </p>
      </LegalSection>

      <LegalSection heading="6. Sharing and disclosure">
        <p>
          We do not sell your personal information. We share information only with:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Service providers who help us operate the Service (such as Supabase,
            Anthropic, OpenAI, Resend for email, and Xero where you connect it),
            bound by their own obligations;
          </li>
          <li>
            Other users you explicitly share a property or account with through the
            Service&rsquo;s sharing features;
          </li>
          <li>
            Authorities or third parties where required by law or to protect our
            rights.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. Your rights and choices">
        <p>
          You may access, correct, or update your information from within the app.
          You can delete your account at any time from Settings, which removes your
          account and associated data as described in the Service. You may also
          disconnect Google sign-in or any connected service. To make a privacy
          request or complaint, contact us at the address below.
        </p>
      </LegalSection>

      <LegalSection heading="8. Data retention">
        <p>
          We retain your information for as long as your account is active or as
          needed to provide the Service. When you delete your account, we delete
          or de-identify your personal information except where we are required to
          retain it to meet legal obligations.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the
          updated version on this page and revise the &ldquo;Last updated&rdquo;
          date above. Material changes will be communicated where appropriate.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact us">
        <p>
          If you have questions about this Privacy Policy or how we handle your
          information, contact us at{" "}
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
