# UI and design system

Loaded when working in `components/`. Also the source for Cursor's `.cursor/rules/ui-design-system.mdc`.

Sources: the live Islands VA design system (https://claude.ai/artifact/Ha5kSyvZ7axkKvVYjupvpK) and `design/islands-va-design-system-guide.pdf` (v1.2). Read the relevant part before inventing layout, colour, type or a new component. The repo wins on architecture, auth, theme, the logo and scope; the PDF's Next.js chapter is not the implementation guide.

## Folders

- `ui/` — design-system primitives (Button, Form, TextField, FileField, Modal, Badge, Alert, EmptyState, Card, Panel, StatCard + Sparkline, DataTable, Pagination, Breadcrumbs, SearchField, FilterMenu, StepList, Stepper, Tabs, DropdownMenu, Tooltip, Toast, Skeleton, ProgressBar, Avatar, TagChip, TaskList, ProfileCard, Calendar, DatePicker, TimeSlotPicker, ScheduleCalendar). No data fetching, no feature imports. Date logic lives in `date-math.ts` (ISO strings, never `Date` objects across the network); category tones and chart colours in `tone.ts`.
- `layout/` — site shell, nav, footer, logo, portal `Workspace`.
- `marketing/` — public-page sections (Hero, Section, FAQ, testimonials, CTA band, package cards, WaveDivider).
- `blog/` — PostCard, PostGrid, FeaturedPost, BlogSidebar, BlogLayout, CommentThread. Ready for a blog; the blog itself is outside the MVP, so no page uses them yet.

## Tokens and styling

- `design/tokens.json` → `npm run tokens` → `app/tokens.css` (generated — never edit it or hard-code hex).
- Tailwind only with brand tokens: `bg-surface-card`, `text-ink`, `rounded-lg`, `type-*` text styles, `elevation-*` shadows; 4px spacing scale.
- Sizes the design system uses inside its components without publishing a token are named once in `app/globals.css`: `type-button` (15/20 semibold), `type-menu` (15/20 medium), `type-micro` (11/14, the schedule grid's smallest labels), `type-body-md` (15/22), `type-stat` (32/38 display) and `border-control` (1.5px). New code uses these, not raw `text-[…]` sizes or `border-[…]` widths.
- Alegreya for display text, h1 and h2; Figtree for everything else (`next/font`).
- Theme follows the visitor's OS (`prefers-color-scheme`): token classes adapt; otherwise `dark:`. No toggle, no theme cookie.
- Plain CSS in `app/globals.css` only where utilities can't express it (e.g. `DataTable`'s phone card layout with container queries).

## Components

- Reuse `ui/` and `layout/`; add variants via props, not one-off styles — a new variant when a second screen needs it.
- Surfaces: a bordered white/lagoon box is a `Card` (`cardSurface` when the element must be a `<form>` or link); a titled portal section is a `Panel` (`boxed` to sit on a Card).
- Server Components by default; `'use client'` only on the smallest leaf that needs state, effects or browser APIs. Prefer platform features (`<details>`, `<dialog>`, popover, CSS) over libraries.
- Forms use `<Form>` (`useActionState`: pending state, error summary as a danger `Alert`, focus on the first invalid field). Inputs have a visible label and are at least 44px tall.
- Status is a `Badge`: icon or dot + word + tint, never colour alone.
- Icons: `<Icon name>` draws a `<symbol>` from `IconSprite` (root layout), so icon shapes ship once in the HTML, not in every client bundle. A new icon = its shape in `ui/icon-sprite.tsx` + its name in `types/icon.ts`.
- Images: `getImageProps()` + `<img>` / `<picture>` in Server Components (no client JS — `<Image>` adds ~5 KB per page); a `prefers-color-scheme` `<picture>` source for themed images.
- Every interactive target is at least 44×44px; focus is always visible.

## Voice and brand

- Sentence case; verb-first buttons ("Request my team", never "Submit"); "you / we / your VA".
- One sunrise (primary) button per view; the CTA band uses ocean because the nav already shows the sunrise one. Orange is a fill, never text on a light background.
- Logo: the Sand & Sea mark plus the live wordmark (`layout/logo.tsx`).
- Never copy showcase content (logos, quotes, prices, phone numbers); never invent testimonials, logos or business claims — real content or `TODO(content)`. Placeholder quotes stay labelled with a Sample badge until real ones replace them (`content/testimonials.ts`).

## Synced with the design system

Last synced 2026-10-26: every component of the design system is in the codebase (tokens 2026-10-17). Toast needs a `ToastProvider` around the client subtree that uses it; none is mounted yet. Intentional differences: no theme toggle, a tab row instead of a drawer for short phone menus; FaqAccordion is `marketing/faq-list`, DashboardShell is the admin and VA shells, PricingTable lives with the pricing page; blog and comment components exist but no blog pages (outside the MVP); no newsletter.
