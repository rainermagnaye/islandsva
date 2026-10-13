import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/page-header";
import { Prose } from "@/components/marketing/prose";
import { Container } from "@/components/ui/container";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Islands VA collects, uses and protects your personal information.",
};

// TODO(legal): draft describing what the site actually does — have it reviewed (Philippine Data Privacy Act,
// plus GDPR/CCPA if you serve EU/California clients) and set the effective date before launch.
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy policy" lead="How we collect, use and protect your information." />
      <Container className="py-12 md:py-16">
        <Prose>
          <p>
            This policy explains how {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles personal information collected
            through this website.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Contact form:</strong> your name, email address, company and message.
            </li>
            <li>
              <strong>Security data:</strong> a one-way hash of your IP address and your browser&apos;s user agent, used only to
              prevent spam and abuse. We do not store your raw IP address.
            </li>
            <li>
              <strong>Usage statistics:</strong> anonymous, cookie-free page-view and performance data.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            We use your details to reply to your enquiry, recommend services and, if you become a client, to provide them. We
            do not sell your information or use it for third-party advertising.
          </p>

          <h2>Cookies and storage</h2>
          <p>
            We don&apos;t use cookies for advertising or tracking. The site&apos;s light or dark look simply follows your
            browser&apos;s setting.
          </p>

          <h2>Who processes your data</h2>
          <ul>
            <li>Vercel (website hosting)</li>
            <li>Supabase (database, hosted in Singapore)</li>
            <li>Resend (email delivery)</li>
            <li>Cloudflare Turnstile (spam protection on the contact form)</li>
          </ul>

          <h2>How long we keep it</h2>
          <p>
            We keep enquiries that don&apos;t lead to a client relationship for up to 24 months, then delete or anonymise them.
          </p>

          <h2>Your rights</h2>
          <p>
            You can ask to see, correct or delete the personal information we hold about you, or object to how we use it.
            {site.email ? ` Email us at ${site.email}.` : " Contact us through the contact page."}
          </p>

          <h2>Changes</h2>
          <p>We&apos;ll update this page if our practices change.</p>
        </Prose>
      </Container>
    </>
  );
}
