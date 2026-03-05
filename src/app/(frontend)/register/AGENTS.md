# Frontend Registration AGENTS.md

This folder contains the client-facing registration flow. It mirrors the admin register-client workflow for step handling, validation, recipient behavior, and UX.

## Summary
- **Step routing**: `step` query param is the single source of truth
- **Validation**: form-level only; avoid field-level validators in step components
- **Step schemas/form shape**: keep aligned with admin register-client workflow
- **Medications step**: optional; no dedicated skip button (use Next)
- **Recipient flows**: support self/employer/court referrals, preset referral recipients, and additional client recipients

## Where to Look
- **Workflow**: `src/app/(frontend)/register/Workflow.tsx`
- **Step components**: `src/app/(frontend)/register/steps/*`
- **Recipients step**: `src/app/(frontend)/register/steps/Recipients.tsx`
- **Shared form opts**: `src/app/(frontend)/register/shared-form.ts`
- **Validators**: `src/app/(frontend)/register/validators.ts`
- **Schemas / types**: `src/app/(frontend)/register/schemas/registrationSchemas.ts`, `src/app/(frontend)/register/types/`

## More Detail
See the admin workflow notes for deeper context and parity requirements:
- `src/views/DrugTestWizard/AGENTS.md`
