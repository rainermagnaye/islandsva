import type { Metadata } from "next";
import { Alegreya, Figtree } from "next/font/google";
import { site } from "@/content/site";
import { EmailLinkSession } from "@/features/auth/components/email-link-session";
import "./globals.css";

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${alegreya.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-3 focus:type-label focus:text-ink focus:elevation-md"
        >
          Skip to main content
        </a>
        <EmailLinkSession />
        {children}
      </body>
    </html>
  );
}
