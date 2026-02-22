# AGENTS.md

Fast repo context for agents working in this codebase. Keep changes aligned with existing UI/workflow patterns.

## Site Structure (App Router)
- **Frontend marketing + auth**: `src/app/(frontend)/`
  - Public pages (home, `[slug]` via blocks)
  - Auth flows: `sign-in`, `register`, `forgot-password`, `reset-password`, `verify-email`
  - Shared layout with `Header` + `Footer` in `src/globals/`
- **Client dashboard**: `src/app/dashboard/`
  - Protected layout with sidebar + header and server-component data fetching
  - Key pages: dashboard, results, medications, profile, schedule (Cal.com), appointments (placeholder)
- **Payload admin**: `src/app/(payload)/admin/`
  - Payload CMS UI plus custom views (Drug Test Wizard / Tracker / analytics)

## Repo-Specific Deep Dives
- **Drug Test Wizard rules**: `src/views/DrugTestWizard/AGENTS.md`
- **Frontend registration rules**: `src/app/(frontend)/register/AGENTS.md`
- **Form UX/validation references**: `docs/forms/contexts.md` (open only for form tasks) + related docs in `docs/forms/`

## Content & Data Architecture
- **Block system**: `src/blocks/` with `src/blocks/RenderBlocks.tsx` as the central renderer
  - When adding blocks, update both the renderer map and the Pages collection config
- **Collections**: `src/collections/`
  - Active collection registration (source of truth): `src/payload.config.ts`
  - Major operational collections: `Clients`, `DrugTests`, `Courts`, `Employers`, `Bookings`, `TestTypes`, `Admins`, `Technicians`
- **Globals**: `src/globals/` for Header, Footer, CompanyInfo

## Workflows & Forms
- **Form system**: TanStack Form with custom field components in `src/blocks/Form/field-components/`
- **Drug Test Wizard (admin workflows)**: `src/views/DrugTestWizard/`
  - Workflows: register clients, instant tests, collect lab, lab screen, lab confirmation
  - Step validation + TanStack Form state are business-critical; check nested AGENTS before changing flow behavior
- **Frontend client registration**: `src/app/(frontend)/register/`
  - Mirrors admin register-client flow patterns (validation, recipients, step UX)

## Testing (Quick Pointer)
- **Playwright e2e**: `tests/e2e/` (frontend registration + wizard workflows)
- **Playwright config**: `playwright.config.ts`
- **E2E env helpers**: see `.env.example` plus optional helper envs in `tests/e2e/helpers/env.ts`

## Design System (Keep It Consistent)
- **Typography**: Geist Sans (Next font) is the primary UI font.
- **Color tokens**: CSS variables in `src/app/(frontend)/globals.css` drive Tailwind theme
  - Use theme tokens (`bg-background`, `text-foreground`, `border-border`, `ring-ring`, etc.)
  - Frontend layout forces light mode (`ThemeProvider forcedTheme="light"`)
- **Tailwind v4 (CSS-first)**: extend via CSS variables in globals, not JS theme config
- **Components**: prefer existing `src/components/ui/` and shadcn patterns
- **Form UX**: consistent input styling, inline validation, explicit step titles/progress, clear primary CTA per step
- **Notifications**: Sonner via `src/components/ui/sonner`

## Data Fetching Pattern (Dashboard)
- Prefer server components with Payload local API (`getPayload()`)
- Pass computed data into client components
- Use server actions for privileged mutations and call `revalidatePath()` after mutations

## Guardrails
- Reuse existing UI patterns; avoid ad-hoc components/styles
- Derive new colors/spacing from existing CSS variables / Tailwind tokens
- For new blocks, update both renderer and Pages collection configuration

## Build & Permissions
- `pnpm build` runs `payload migrate` and requires local services (MongoDB, and SMTP if email flows are involved)
- In sandboxed Codex sessions, build/network restrictions can cause `EPERM` failures; rerun with scoped build permission when needed
