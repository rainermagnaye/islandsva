import { cardSurface } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";

type Faq = { question: string; answer: string };

/**
 * The design system's FaqAccordion look on native <details>: keyboard, screen-reader and in-page-search
 * support with zero JavaScript. Each question is a heading inside its summary; the plus turns into a
 * sunrise × when open. Every answer starts closed until the visitor opens it. Also emits FAQPage
 * structured data for search results.
 */
export function FaqList({ items, headingLevel = 3 }: { items: readonly Faq[]; headingLevel?: 3 | 4 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="mx-auto grid w-full max-w-[820px] gap-3">
      {items.map((item) => (
        <details
          key={item.question}
          className={cx(cardSurface, "group reveal transition-[border-color,box-shadow] open:border-border-strong open:elevation-sm")}
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 text-ink hover:text-action-secondary [&::-webkit-details-marker]:hidden">
            <Heading className="m-0 font-sans text-[1.0625rem] leading-6 font-semibold">{item.question}</Heading>
            <span
              aria-hidden="true"
              className="grid size-8 flex-none place-items-center rounded-full bg-status-info-bg text-action-secondary transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-45 group-open:bg-action-primary group-open:text-on-action-primary"
            >
              <Icon name="plus" size={18} />
            </span>
          </summary>
          <p className="m-0 max-w-[68ch] px-5 pb-5 text-ink-muted">{item.answer}</p>
        </details>
      ))}
      <FaqStructuredData items={items} />
    </div>
  );
}

/** schema.org FAQPage JSON-LD. A data block, not a script: the CSP doesn't apply and nothing executes. */
function FaqStructuredData({ items }: { items: readonly Faq[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  // Escape "<" so the content can never close the <script> element early.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
