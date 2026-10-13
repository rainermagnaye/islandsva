export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  /** Placeholder for layout work — shown with a "Sample" badge, never in production. */
  sample?: true;
};

// Real client quotes only, with the client's permission. Sections that use this stay hidden while it's empty.
// Example: { id: "maria-acme", quote: "…", author: "Maria Santos", role: "Founder", company: "Acme Co." }
const realTestimonials: Testimonial[] = [];

// TODO(content): replace with real quotes. These exist only so the testimonial grid can be designed and
// reviewed in development. They are never published: production builds and any build with a real quote
// ignore them, and each card shows a "Sample" badge.
const sampleTestimonials: Testimonial[] = [
  {
    id: "sample-1",
    quote: "Sample quote: our inbox was cleared before we started each morning, and overnight customer messages were already answered.",
    author: "Sample client",
    role: "Founder",
    company: "Example Co.",
    sample: true,
  },
  {
    id: "sample-2",
    quote: "Sample quote: the day and night handover means nothing waits for us, whatever time zone our customers are in.",
    author: "Sample client",
    role: "Operations lead",
    company: "Example Co.",
    sample: true,
  },
  {
    id: "sample-3",
    quote: "Sample quote: onboarding took about a week, and our assistant was soon handling scheduling without being asked.",
    author: "Sample client",
    role: "Practice manager",
    company: "Example Co.",
    sample: true,
  },
];

export const testimonials: Testimonial[] =
  realTestimonials.length > 0 || process.env.NODE_ENV === "production" ? realTestimonials : sampleTestimonials;
