# DrugTestWizard AGENTS.md

This folder contains admin-panel multi-step workflows for client registration and drug test processing. The frontend registration flow mirrors these patterns to keep behavior consistent.

## Core Workflow Rules
- **Step routing**: `step` query param (`nuqs`) is the navigation source of truth
- **Form state**: TanStack Form with `withForm` wrappers per step
- **Validation**: form-level only (avoid field-level validators inside step components)
- **Step validation**: validate only the current step before advancing (`parseValuesWithSchema(...)`)
- **Email uniqueness checks**: performed during the account step

## Files to Know
- **Workflow entrypoints**: `src/views/DrugTestWizard/workflows/*/Workflow.tsx`
- **Register-client validators**: `src/views/DrugTestWizard/workflows/register-client-workflow/validators.ts`
- **Register-client recipients step**: `src/views/DrugTestWizard/workflows/register-client-workflow/steps/Recipients.tsx`
- **Shared registration form opts**: `src/app/(frontend)/register/shared-form.ts` (used by admin + frontend)
- **Registration dialog**: `src/views/DrugTestWizard/components/RegisterClientDialog.tsx`

## UX / Error Handling
- Current-step errors disable Next until fixed
- On invalid submit, scroll/focus the first invalid field
- Inputs should keep `aria-invalid` and stable `id`/`name` values matching TanStack field names
- Backward navigation should clear stale validation state when possible

## Formatting Rules (Registration)
- **Names**: preserve casing; only fix obvious first-letter capitalization
- **Middle initial**: single uppercase character
- **Phone**: normalize to US 10-digit format (no `+1`)
- **Dates**: use helpers in `src/lib/date-utils.ts` for date-only values

## Recipient Flow Notes (Business-Critical)
- Recipient behavior now combines referral presets (court/employer) with client-specific additional recipients
- "Other employer/court" flows can save additional recipients to the new referral profile
- Keep frontend and admin recipient step behavior in sync when changing validation or form shape

## Frontend Counterpart
- `src/app/(frontend)/register/AGENTS.md`
