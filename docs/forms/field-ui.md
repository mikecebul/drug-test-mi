# Field UI (shadcn) Reference

Use this guide when creating or updating form fields in this repo.

## Canonical Rule
- Build field components with `Field` primitives from `src/components/ui/field.tsx`.
- Do not use ad-hoc label/error wrappers in reusable field components.

## Official shadcn Docs
- Field component docs: [shadcn/ui Field](https://ui.shadcn.com/docs/components/field)

## Install
```bash
npx shadcn@latest add field
```

## Required Anatomy
```tsx
<Field data-invalid={hasErrors}>
  <FieldLabel htmlFor={id}>Label</FieldLabel>
  <Input id={id} aria-invalid={hasErrors || undefined} />
  <FieldDescription>Optional helper text.</FieldDescription>
  <FieldError errors={errors} />
</Field>
```

## Imports
```tsx
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
```

## Grouping Patterns
- Use `FieldSet` + `FieldLegend` for semantic groups.
- Use `FieldGroup` to stack related fields.
- Use `FieldSeparator` between sections.
- Use `orientation="horizontal"` for checkbox/radio/switch rows.
- Use `orientation="responsive"` in container-query layouts.

## Validation Pattern
- Set `data-invalid` on `Field` when errors exist.
- Set `aria-invalid` on the input/select/textarea control.
- Render `FieldError` directly under the control.
- For TanStack Form, pass `field.state.meta.errors` to `FieldError`.

```tsx
const errors = field.state.meta.errors
const hasErrors = errors.length > 0

<Field data-invalid={hasErrors}>
  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
  <Input id={field.name} aria-invalid={hasErrors || undefined} />
  <FieldError errors={errors} />
</Field>
```

## Repo Notes
- `FieldError` in this repo already normalizes mixed error shapes (`string`, `{ message }`, `Error`, nested arrays, `issues`/`errors` containers).
- Prefer this pattern in `src/blocks/Form/field-components/*` and workflow forms.
