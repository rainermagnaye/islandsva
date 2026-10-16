import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSearch } from "@/components/marketing/faq-search";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StepList } from "@/components/ui/step-list";
import { aboutFaqs } from "@/content/faqs";

export const metadata: Metadata = {
  title: "About",
  description: "Islands VA connects growing businesses with dedicated virtual assistants from the Philippines — support, day and night.",
};

const values = [
  { icon: "users" as const, title: "People first", body: "We hire assistants for skill and character, and support them so they stay and grow with your business." },
  { icon: "shield" as const, title: "Trust by default", body: "Clear access rules, accounts you control and honest updates — your business is safe in our hands." },
  { icon: "clock" as const, title: "Always on", body: "Day shift, night shift or both. Continuous support is the promise in our name." },
  { icon: "check" as const, title: "Quietly excellent", body: "The best assistance is the kind you stop noticing. Things simply get done." },
];

const vetting = [
  { title: "Skills and English assessment", body: "Written and spoken English, tools and real-world task tests." },
  { title: "Interviews and reference checks", body: "We meet every candidate and check their work history." },
  { title: "Matching", body: "We pair each assistant with clients whose work fits their strengths." },
  { title: "Ongoing support", body: "Regular check-ins with you and your VA, and help whenever it's needed." },
];

// TODO(content): replace with the founders' story, team size and photos (real people, with consent).
export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Support, day and night"
        lead="Islands VA connects growing businesses with dedicated virtual assistants from the Philippines — people who learn how you work and keep things running while you focus on what matters."
      />

      <Section id="story" eyebrow="Our story" title="Why we started Islands VA">
        <div className="grid max-w-(--container-prose) gap-4 type-body-lg text-ink-muted">
          <p className="m-0">
            Too many business owners spend their best hours on inboxes, calendars and follow-ups. Meanwhile, the Philippines
            is home to some of the most capable, dedicated assistants in the world.
          </p>
          <p className="m-0">
            We built Islands VA to bring the two together — properly. We find and vet great assistants, match them with the
            right clients and stay involved, so every partnership works long after the first week.
          </p>
        </div>
      </Section>

      <Section id="values" tone="sunken" eyebrow="What we value" title="How we work">
        <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2">
          {values.map((v) => (
            <Card as="li" key={v.title} className="reveal grid content-start gap-3">
              <Icon name={v.icon} size={28} className="text-action-secondary" />
              <h3 className="m-0 type-h3">{v.title}</h3>
              <p className="m-0 text-ink-muted">{v.body}</p>
            </Card>
          ))}
        </ul>
      </Section>

      <Section id="vetting" eyebrow="Our assistants" title="Every VA is vetted and supported">
        <StepList steps={vetting} itemClassName="reveal" className="max-w-(--container-prose)" />
      </Section>

      <Section id="faq" tone="sunken" align="center" eyebrow="Questions" title="About working with us">
        <FaqSearch items={aboutFaqs} />
      </Section>

      <CtaBand />
    </>
  );
}
