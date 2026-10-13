import { cacheLife } from "next/cache";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { site } from "@/content/site";
import { Logo } from "./logo";

// Only the copyright year changes, so a weekly refresh is plenty. Every page includes the footer, so a
// shorter life here would make the whole site regenerate that often.
async function currentYear() {
  "use cache";
  cacheLife("weeks");
  return new Date().getFullYear();
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const link =
  "inline-flex min-h-9 items-center rounded-sm text-ink-on-deep-muted no-underline transition-colors hover:text-brand-lagoon hover:underline hover:underline-offset-4";

/**
 * The design system's Footer: brand-deep, rising out of the page on a three-layer wave, with the night
 * lockup, tagline, contact lines, link columns and the legal row. Fixed brand hues, so it looks the same in
 * both themes (sand headings 10.2:1, links 7.8:1, sunrise focus rings).
 */
export async function Footer() {
  const year = await currentYear();
  return (
    <footer className="@container text-brand-sand [&_:focus-visible]:outline-brand-sunrise">
      <svg viewBox="0 0 1200 64" preserveAspectRatio="none" aria-hidden="true" focusable="false" className="-mb-px block h-16 w-full">
        <path d="M0 30 C150 8 300 52 450 30 S750 8 900 30 S1150 52 1200 30 V64 H0Z" className="fill-brand-lagoon opacity-35" />
        <path d="M0 42 C200 24 350 60 600 40 S1000 24 1200 44 V64 H0Z" className="fill-brand-reef opacity-55" />
        <path d="M0 54 C250 40 450 66 700 50 S1050 42 1200 54 V64 H0Z" className="fill-brand-deep" />
      </svg>
      <div className="bg-brand-deep">
        <div className="mx-auto grid max-w-(--container-max) gap-10 px-4 pt-10 pb-8 @min-[768px]:grid-cols-[1.2fr_2fr] @min-[768px]:px-8 @min-[768px]:pt-12 @min-[768px]:pb-10">
          <div className="grid content-start justify-items-start gap-3">
            <Logo tone="night" />
            <p className="m-0 type-eyebrow text-brand-sunrise">{site.tagline}.</p>
            <ul className="m-0 mt-2 grid list-none gap-2 p-0 text-[0.9375rem] text-ink-on-deep-muted">
              {site.email && (
                <li className="flex items-center gap-2">
                  <Icon name="mail" size={18} className="text-brand-lagoon" />
                  <a href={`mailto:${site.email}`} className={link}>
                    {site.email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Icon name="map-pin" size={18} className="text-brand-lagoon" />
                <span>Based in the {site.location}</span>
              </li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 @min-[768px]:grid-cols-3">
            {site.footer.map((col) => (
              <nav key={col.title} aria-labelledby={`footer-${slug(col.title)}`}>
                <h2 id={`footer-${slug(col.title)}`} className="m-0 mb-3 font-sans text-[0.9375rem] leading-5 font-semibold text-brand-sand">
                  {col.title}
                </h2>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {col.links.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className={link}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="border-t border-brand-sand/15">
          <div className="mx-auto flex max-w-(--container-max) flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-5 pb-6 type-body-sm text-ink-on-deep-muted @min-[768px]:px-8">
            <p className="m-0 mr-auto">
              © {year} {site.name}. All rights reserved.
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
              {site.legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
