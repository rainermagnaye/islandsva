import { routes } from "./routes";

export const site = {
  name: "Islands VA",
  tagline: "Support, day and night",
  description:
    "Dedicated virtual assistants from the Philippines who handle your inbox, calendar, customer replies and admin — day and night.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://islandsva.com",
  // TODO(content): public contact email and location shown on the Contact page and footer.
  email: undefined as string | undefined,
  location: "Philippines",
  nav: [
    { label: "Packages", href: routes.packages },
    { label: "Pricing", href: routes.pricing },
    { label: "Testimonials", href: routes.testimonials },
    { label: "Brands", href: routes.brands },
    { label: "About", href: routes.about },
  ],
  cta: { label: "Book a discovery call", href: routes.contact },
  legal: [
    { label: "Privacy", href: routes.privacy },
    { label: "Terms", href: routes.terms },
  ],
  footer: [
    {
      title: "Services",
      links: [
        { label: "Packages", href: routes.packages },
        { label: "Pricing", href: routes.pricing },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: routes.about },
        { label: "Testimonials", href: routes.testimonials },
        { label: "Brands", href: routes.brands },
      ],
    },
    {
      title: "Get started",
      links: [
        { label: "Book a discovery call", href: routes.contact },
        { label: "Client login", href: routes.login },
      ],
    },
  ],
} as const;
