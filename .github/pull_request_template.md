## What and why

<!-- What changes, and the problem it solves. Link the issue or task. -->

## Trade-offs

<!-- What you chose not to do, and any risk. "None" is a fine answer. -->

## Testing

<!-- What you ran and what you checked by hand (pages, roles, both themes, phone width). -->

## Checklist

- [ ] CI is green (lint, typecheck, test, build, size).
- [ ] New `parseX`, pure rules and permission branches have tests; a security test fails when its rule is removed.
- [ ] Every page and Server Action that reads or writes calls `requireRole` / `requireUser` first.
- [ ] No secrets, PII or invented content (testimonials, logos, claims) added.
- [ ] Docs updated in the same PR if a convention, folder, script, env var or decision changed (`CLAUDE.md`, `supabase/CLAUDE.md`, `components/CLAUDE.md`, `docs/`).
- [ ] **Database:** no migration — or a new one under `supabase/migrations/` (never an edited applied one), with allowed/denied tests, and a note on when a person applies it live (`docs/operations.md`). Code that needs it must not merge before it's applied.
- [ ] **Env vars / dependencies:** none — or listed here, with `.env` comments updated.
- [ ] Under 400 lines, or split / explained.
