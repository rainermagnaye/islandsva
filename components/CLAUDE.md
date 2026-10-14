# UI and design system

Loaded when working in `components/`. Also the source for Cursor's `.cursor/rules/ui-design-system.mdc`.

Sources: the live Islands VA design system (https://claude.ai/artifact/Ha5kSyvZ7axkKvVYjupvpK) and `design/islands-va-design-system-guide.pdf` (v1.2). Read the relevant part before inventing layout, colour, type or a new component. The repo wins on architecture, auth, theme, the logo and scope; the PDF's Next.js chapter is not the implementation guide.

## Folders

- `ui/` — design-system primitives (Button, Form, TextField, Modal, Badge, Alert, EmptyState, StatCard, DataTable, Pagination, Breadcrumbs, …). No data fetching, no feature imports.
- `layout/` — site shell, nav, footer, logo, portal `Workspace`.
- `marketing/` — public-page sections (Hero, Section, FAQ, testimonials, CTA band, package cards).

## Tokens and styling

- `design/tokens.json` → `npm run tokens` → `app/tokens.css` (generated — never edit it or hard-code hex).
- Tailwind only with brand tokens: `bg-surface-card`, `text-ink`, `rounded-lg`, `type-*` text styles, `elevation-*` shadows; 4px spacing scale.
- Alegreya for display text, h1 and h2; Figtree for everything else (`next/font`).
- Theme follows the visitor's OS (`prefers-color-scheme`): token classes adapt; otherwise `dark:`. No toggle, no theme cookie.
- Plain CSS in `app/globals.css` only where utilities can't express it (e.g. `DataTable`'s phone card layout with container queries).

## Components

- Reuse `ui/` and `layout/`; add variants via props, not one-off styles — a new variant when a second screen needs it.
- Server Components by default; `'use client'` only on the smallest leaf that needs state, effects or browser APIs. Prefer platform features (`<details>`, `<dialog>`, popover, CSS) over libraries.
- Forms use `<Form>` (`useActionState`: pending state, error summary as a danger `Alert`, focus on the first invalid field). Inputs have a visible label and are at least 44px tall.
- Status is a `Badge`: icon or dot + word + tint, never colour alone.
- Images: `getImageProps()` + `<img>` / `<picture>` in Server Components (no client JS — `<Image>` adds ~5 KB per page); a `prefers-color-scheme` `<picture>` source for themed images.
- Every interactive target is at least 44×44px; focus is always visible.

## Voice and brand

- Sentence case; verb-first buttons ("Request my team", never "Submit"); "you / we / your VA".
- One sunrise (primary) button per view; the CTA band uses ocean because the nav already shows the sunrise one. Orange is a fill, never text on a light background.
- Logo: the Sand & Sea mark plus the live wordmark (`layout/logo.tsx`).
- Never copy showcase content (logos, quotes, prices, phone numbers); never invent testimonials, logos or business claims — real content or `TODO(content)`. Placeholder data must be labelled, development-only and absent from production builds (`content/testimonials.ts`).

## Synced with the design system

Last synced 2026-10-13: tokens, icons, portal components and the landing page. Intentional differences: no theme toggle, a tab row instead of a drawer for short phone menus, no Toast until an action needs one; no blog, comments or newsletter (outside the MVP).
