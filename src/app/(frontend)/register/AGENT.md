# Frontend Registration AGENT.md

This folder contains the client-facing registration flow. It mirrors the
admin-panel register-client workflow for step handling, validation, and UX.

## Summary
- **Step routing**: `step` query param is the single source of truth.
- **Validation**: form-level only; no field-level validators.
- **Step schemas**: reused from admin workflow where possible.
- **Medications step**: optional; no dedicated skip button (use Next).

## Where to Look
- **Workflow**: `src/app/(frontend)/register/Workflow.tsx`
- **Step components**: `src/app/(frontend)/register/steps/*`
- **Shared form opts**: `src/app/(frontend)/register/shared-form.ts`
- **Validators**: `src/app/(frontend)/register/validators.ts`

## More Detail
See the admin workflow notes for deeper context:
- `src/views/DrugTestWizard/AGENTS.md`
