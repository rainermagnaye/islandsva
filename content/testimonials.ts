export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
};

// Real client quotes only, with the client's permission. Sections that use this stay hidden while it's empty.
// Example: { id: "maria-acme", quote: "…", author: "Maria Santos", role: "Founder", company: "Acme Co." }
export const testimonials: Testimonial[] = [];
