import { cacheLife } from "next/cache";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { site } from "@/content/site";
import { Logo } from "./logo";

// Only the copyright year changes, so a weekly refresh is plenty. Every page includes the footer, so a
// shorter life here would make the whole site regenerate that often.
async function currentYear() {
  "use cache";
  cacheLife("weeks");
  return new Date().getFullYear();
}

export async function Footer() {
  const year = await currentYear();
  return (
    <footer className="border-t border-border bg-surface-sunken">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)] md:py-16">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="m-0 max-w-[32ch] type-body-sm text-ink-muted">{site.description}</p>
        </div>
        {site.footer.map((col) => (
          <nav key={col.title} aria-label={col.title} className="grid content-start gap-2">
            <h2 className="m-0 type-label text-ink">{col.title}</h2>
            <ul className="m-0 grid list-none gap-1 p-0">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center type-body-sm text-ink-muted no-underline hover:text-action-secondary hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border py-6 type-body-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">
          © {year} {site.name}. {site.tagline}.
        </p>
        <ul className="m-0 flex list-none gap-4 p-0">
          {site.legal.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="inline-flex min-h-11 items-center text-ink-muted hover:text-action-secondary">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </footer>
  );
}
