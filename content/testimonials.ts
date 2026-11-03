export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
  /** Placeholder — the card shows a "Sample" badge until a real quote replaces it. */
  sample?: true;
};

// Real client quotes only, with the client's permission.
// Example: { id: "maria-acme", quote: "…", author: "Maria Santos", role: "Founder", company: "Acme Co." }
const realTestimonials: Testimonial[] = [
  {
    id: "kelsey-nectar",
    quote:
      "She had an intuitive ability to let a little fun shine through in her responses perfectly aligning with our brand's voice and making customers feel truly valued.",
    author: "Kelsey Stansbury",
    role: "Customer Relations Manager",
    company: "Nectar Life",
  },
  {
    id: "hope-digifox",
    quote:
      "Helps us service our customers during our normal out of office hours and sometimes over the weekend as well. She does a fantastic job taking care of our customers and supporting our team.",
    author: "Hope Anderson (Szymanski)",
    role: "Head of Ops",
    company: "Digifox",
  },
  {
    id: "alexander-crossfi",
    quote: "Support is one of the most valuable assets of our company.",
    author: "Alexander Mamasidikov",
    role: "Founder",
    company: "CrossFi",
  },
];

// TODO(content): replace with real quotes. Shown, with a Sample badge, until then — including on the
// deployed site — so the page is not an empty state. A real quote replaces this whole list.
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

export const testimonials: Testimonial[] = realTestimonials.length > 0 ? realTestimonials : sampleTestimonials;
