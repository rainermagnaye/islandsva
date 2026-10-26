import type { Metadata } from "next";
import { FaqSearch } from "@/components/marketing/faq-search";
import { PageHeader } from "@/components/marketing/page-header";
import { Prose } from "@/components/marketing/prose";
import { Section } from "@/components/marketing/section";
import { Container } from "@/components/ui/container";
import { privacyFaqs } from "@/content/faqs";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Islands VA collects, uses and protects your personal information.",
};

// TODO(legal): this draft describes what the site and portal actually do (checked against the code on 2026-10-26).
// Before launch it needs a legal review (Philippine Data Privacy Act; GDPR/CCPA if you serve EU or California
// clients), the decisions marked TODO(legal) below, and an effective date. Keep it in step with the product: a new
// form, field, file, email or service provider means an update here (CLAUDE.md §6).
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy policy" lead="How we collect, use and protect your information." />
      <Container className="py-12 md:py-16">
        <Prose>
          <p>
            This policy explains how {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles personal information collected
            through this website and our client and team portal. {/* TODO(legal): the legal entity's name and address. */}
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Website enquiries:</strong> your name, email address, company, industry, country, the package you&apos;re
              interested in and your message.
            </li>
            <li>
              <strong>Security data:</strong> for enquiries, a one-way hash of your IP address and your browser&apos;s user agent,
              used only to prevent spam and abuse. We do not store your raw IP address.
            </li>
            <li>
              <strong>Client registration:</strong> when we send you a registration link: your company and contact details,
              phone number, business details (industry, country, website, job title, address, team size and what you&apos;d like
              help with), the name you type to accept our terms and when you did so, and the proof of payment file you upload.
            </li>
            <li>
              <strong>Payments:</strong> the amount we received, any bank or transfer fee, the date and the payment reference,
              which our team records when confirming your registration. We don&apos;t collect or store card details.
            </li>
            <li>
              <strong>Your account:</strong> your sign-in email and password (stored only in hashed form by our database
              provider), and, for our team, a two-factor authentication setup.
            </li>
            <li>
              <strong>Demo calls and your VA:</strong> the time you book, any note you add for the VA, the VA&apos;s answer, and
              which VA works with you.
            </li>
            <li>
              <strong>VA and team applicants</strong> (by invitation only): your contact details and address, date of birth and
              other details you enter in your profile, emergency contact, education, work history, skills, languages, the
              references you name, your résumé file and profile photo, and our review notes.
            </li>
            <li>
              <strong>Notes:</strong> our team may keep notes, and files you send us, on a client&apos;s or applicant&apos;s
              record.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            We use your details to reply to your enquiry, register you as a client, match you with a VA, arrange demo calls,
            confirm payments, run your account, review applications from VAs, and keep the service secure. We do not sell your
            information or use it for advertising. {/* TODO(legal): the legal basis for each use (contract, consent, legitimate interest). */}
          </p>

          <h2>Emails we send</h2>
          <p>
            Messages about your enquiry, registration, account (including sign-in and password links) and demo calls. We
            don&apos;t send marketing emails.
          </p>

          <h2>Cookies and storage</h2>
          <p>
            When you sign in, we set cookies that keep you signed in; the site doesn&apos;t work without them. We don&apos;t use
            cookies for advertising or tracking, and we don&apos;t run analytics. The site&apos;s light or dark look simply
            follows your browser&apos;s setting.
          </p>

          <h2>Who processes your data</h2>
          <ul>
            <li>Vercel (website and portal hosting; our servers run in Singapore)</li>
            <li>Supabase (database, sign-in and file storage, hosted in Singapore)</li>
            <li>Resend (email delivery)</li>
            <li>Cloudflare Turnstile (spam protection on the contact form)</li>
          </ul>
          {/* TODO(legal): international transfers (data is stored in Singapore; clients may be elsewhere). */}

          <h2>Who can see it</h2>
          <p>
            Only the people who need it: our admins, the Closer who looks after your account, and your VA (who sees your company
            name, contact name and email, time zone and agreed hours, not your billing or payment records). Clients don&apos;t see other clients&apos;
            information.
          </p>

          <h2>How long we keep it</h2>
          {/* TODO(legal): decide retention periods. Today nothing is deleted automatically; accounts are deactivated, not deleted. */}
          <p>We keep your information while you&apos;re a client or team member, and as long as we need it for our records.</p>

          <h2>Your rights</h2>
          <p>
            You can ask to see, correct or delete the personal information we hold about you, or object to how we use it.
            {site.email ? ` Email us at ${site.email}.` : " Contact us through the contact page."}
          </p>

          <h2>Changes</h2>
          <p>We&apos;ll update this page if our practices change.</p>
        </Prose>
      </Container>
      <Section id="faq" tone="sunken" align="center" eyebrow="Questions" title="Privacy questions">
        <FaqSearch items={privacyFaqs} />
      </Section>
    </>
  );
}
