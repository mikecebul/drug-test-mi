# DrugTestWizard AGENTS.md

This folder contains the admin-panel workflows that power multi-step registration
and drug test flows. These patterns are mirrored in the frontend registration
flow to keep behavior consistent.

## How the Workflow System Works

- **Single source of truth for steps**: Query params (`step`) via `nuqs` drive navigation.
- **Form state**: TanStack Form with `withForm` wrappers per step component.
- **Validation**: Form-level only. No field-level validators in step components.
- **Step validation**: Each step uses `formApi.parseValuesWithSchema(...)` for the current step.
- **Email uniqueness**: Only checked during the account step.

## Files to Know

- **Workflows**: `src/views/DrugTestWizard/workflows/*/Workflow.tsx`
- **Shared validators**: `src/views/DrugTestWizard/workflows/register-client-workflow/validators.ts`
- **Shared form opts**: `src/app/(frontend)/register/shared-form.ts` (used by admin + frontend)
- **Registration dialog**: `src/views/DrugTestWizard/components/RegisterClientDialog.tsx`

## UX / Error Handling

- **Current-step errors** disable Next until fixed.
- **Focus management**: on invalid submit, scroll to and focus the first invalid field.
  - Inputs set `aria-invalid` and `id`/`name` to match TanStack field names.
- **Backward navigation** re-validates to clear stale errors.

## Formatting Rules (Registration)

- **Names**: preserve casing; only uppercase first character if user forgets.
- **Middle initial**: single uppercase character.
- **Phone**: normalized to US 10-digit format (no `+1`).
- **Dates**: use helpers in `src/lib/date-utils.ts` for date-only values.

## Frontend Link

The frontend registration flow mirrors this structure:

- `src/app/(frontend)/register/AGENT.md`
