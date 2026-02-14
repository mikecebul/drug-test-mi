# AGENTS.md

This file gives fast, practical context for working in this repo: high-level structure and the design rules to keep UI consistent.

## Site Structure (App Router)
- **Frontend marketing + auth**: `src/app/(frontend)/`
  - Public pages (home, [slug] pages via blocks)
  - Auth flows: `sign-in`, `register`, `forgot-password`, `reset-password`, `verify-email`
  - Shared layout with `Header` + `Footer` in `src/globals/`
- **Client dashboard**: `src/app/dashboard/`
  - Protected layout with sidebar + header and server-component data fetching
  - Key pages: main dashboard, results, medications, profile, schedule (Cal.com), appointments (placeholder)
- **Payload admin**: `src/app/(payload)/admin/` (PayloadCMS UI)

## Content & Data Architecture
- **Block system**: `src/blocks/` with `RenderBlocks.tsx` as central renderer
  - Update blocks map in `RenderBlocks.tsx` and Pages collection when adding new blocks
- **Payload collections**: `src/collections/`
  - `DrugTests`, `Clients`, `Technicians`, `Admins`, `Bookings`, `Pages`, `Forms`, `FormSubmissions`, `Media`, `PrivateMedia`
- **Globals**: `src/globals/` for Header, Footer, CompanyInfo

## Workflows & Forms
- **Form system**: TanStack Form with custom field components in `src/blocks/Form/field-components/`
- **Forms quick-reference contexts (progressive discovery)**: `docs/forms/contexts.md`
  - Only open this doc when a task touches form UX, validation, or field components.
- **Field UI reference (shadcn + repo conventions)**: `docs/forms/field-ui.md`
  - Use this when creating/updating form fields.
- **PDF Upload Wizard (Admin workflows)**: `src/views/PDFUploadWizard/`
  - `PDFUploadWizardClient.tsx` routes between workflows:
    - Register clients
    - Create drug test records (15-panel instant)
    - Collect lab samples
    - Enter lab screen results
    - Enter lab confirmation results
  - Workflow steps are defined via per-workflow `validators` and TanStack Form state
  - Business-critical workflow notes (client registration + drug test creation/updating): `src/views/PDFUploadWizard/AGENT.md`
- **Frontend client registration**: `src/app/(frontend)/register/`
  - Public multi-step registration form for new clients
  - Business-critical UX/validation notes: `src/app/(frontend)/register/AGENT.md`

## Design System (Keep It Consistent)
- **Typography**: Geist Sans (Next font) as the primary UI font.
- **Color tokens**: CSS variables in `src/app/(frontend)/globals.css` drive Tailwind theme.
  - Use `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring` etc.
  - Light mode is forced in frontend layout (`ThemeProvider forcedTheme="light"`).
- **Tailwind v4 (CSS-first)**: Use Tailwind only via CSS (`@import 'tailwindcss'` + `@theme` tokens in globals).
  - Avoid JS config-driven theming; extend via CSS variables in `globals.css`.
  - Prefer existing components in `src/components/ui/` and shadcn patterns.
- **Spacing & layout**:
  - Use consistent spacing scale (Tailwind spacing + `--radius` in globals).
  - Prefer clean, clinical layouts: clear section headings, generous whitespace, and obvious primary actions.
- **Form UX**:
  - Use consistent input styling and inline validation.
  - Keep multi-step flows explicit: clear step titles, progress cues, and a primary CTA per step.
- **Notifications**: Sonner toasts via `src/components/ui/sonner`.

## Data Fetching Pattern (Dashboard)
- Prefer server components with Payload local API (`getPayload()`), pass computed data to client components.
- Use server actions for mutations that require elevated access; call `revalidatePath()` after mutations.

## Guardrails
- Avoid introducing ad-hoc UI patterns; reuse existing component styles.
- Keep all new colors and spacing derived from existing CSS variables / Tailwind tokens.
- For new blocks, update both renderer and Pages collection configuration.
