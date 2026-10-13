import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { Section } from "@/components/marketing/section";
import { Icon } from "@/components/ui/icon";

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
            <li key={v.title} className="reveal grid content-start gap-3 rounded-lg border border-border bg-surface-card p-6">
              <Icon name={v.icon} size={28} className="text-action-secondary" />
              <h3 className="m-0 type-h3">{v.title}</h3>
              <p className="m-0 text-ink-muted">{v.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="vetting" eyebrow="Our assistants" title="Every VA is vetted and supported">
        <ol className="m-0 grid max-w-(--container-prose) list-none gap-5 p-0">
          {[
            ["Skills and English assessment", "Written and spoken English, tools and real-world task tests."],
            ["Interviews and reference checks", "We meet every candidate and check their work history."],
            ["Matching", "We pair each assistant with clients whose work fits their strengths."],
            ["Ongoing support", "Regular check-ins with you and your VA, and help whenever it's needed."],
          ].map(([title, body], i) => (
            <li key={title} className="reveal grid grid-cols-[auto_1fr] gap-4">
              <span className="grid size-10 place-items-center rounded-pill bg-status-info-bg type-label text-action-secondary">{i + 1}</span>
              <div className="grid gap-1">
                <h3 className="m-0 type-h4">{title}</h3>
                <p className="m-0 text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand />
    </>
  );
}
