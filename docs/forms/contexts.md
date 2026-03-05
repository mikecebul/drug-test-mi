# Forms Contexts

Use this file only for form-related tasks to keep context loading small.

| Context | Use When | Standard Pattern | Avoid | Reference |
| --- | --- | --- | --- | --- |
| Field anatomy | You are building or updating reusable form field components. | Wrap controls with `Field` and use `FieldLabel`, `FieldDescription`, and `FieldError` in that order. Set `data-invalid` on `Field` and `aria-invalid` on the control when errors exist. | Mixing ad-hoc wrappers (`<div>`, `<label>`, custom error `<p>`) for some fields while others use `Field` primitives. | `docs/forms/field-ui.md`, `src/components/ui/field.tsx`, `src/blocks/Form/field-components/substance-checklist-field.tsx` |
| Managing field errors | You need to render validation errors from TanStack Form fields or array fields. | Use `FieldError` and pass `field.state.meta.errors` directly: `<FieldError errors={field.state.meta.errors} />`. `FieldError` handles string errors, `{ message }` objects, native `Error`, nested arrays, and issue/error containers. | Creating ad-hoc helpers (for example `getErrorText`) or rendering raw `errors[0]` in local `<p>` elements. | `src/components/ui/field.tsx`, `src/views/DrugTestWizard/workflows/components/emails/referrals/ReferralProfileDialog.tsx` |
