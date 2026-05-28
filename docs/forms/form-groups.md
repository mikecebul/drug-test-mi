---
id: form-groups
title: Form Groups
---

When building a multi-stage form that has many stages, like so:

![Form stepper](https://raw.githubusercontent.com/TanStack/form/main/docs/assets/stepper.png)

It's common for each step to have its own form. However, this complicates the form submission and validation process by requiring you to add complex logic.

Luckily, TanStack Form provides a way to build out sub-forms that make this kind of development trivial to implement: `<form.FormGroup>`.

## Usage

To use a form group in TanStack Form, you'll use `useForm` or [`useAppForm`](./form-composition.md) to create a `form` variable, then reference its `FormGroup` component like you would a `Field`:

```tsx
const form = useForm({
    defaultValues: {
        step1: {
            name: ""
        },
        step2: {
            age: 0
        }
    }
})

return (
    <form.FormGroup
        name="step1"
        children={group => (
            // `group` here has all of the form-like methods you'd expect like `deleteField` or `insertFieldValue`
            // ...
        )}
    />
)
```

This becomes much more useful when paired with external state to conditionally render a `FormGroup`:

```tsx
const [step, setStep] = useState(0)
const form = useForm({
    defaultValues: {
        step1: {
            name: ""
        },
        step2: {
            age: 0
        }
    }
})

return (
    <>
        {step === 0 ? <form.FormGroup
            name="step1"
            onGroupSubmit={() => {
                // We can move the step forward when validation passes
                setStep(step + 1)
            }}
            onGroupSubmitInvalid={() => {
                // Or handle invalid submissions, just like a top-level form
            }}
            onSubmitMeta={{} as SomeType}
            children={group => (
                // Use `group.handleSubmit()` to submit the sub-form, but not the parent form
                // ...
            )}
        /> : null }
        {step === 1 ? <form.FormGroup
            name="step2"
            children={group => (
                // Then, use `form.handleSubmit()` to submit the entire form
                // ...
            )}
        /> : null }
    </>
)
```

## Form Group Validation

Form groups have a distinct validation proceedure that we think makes sense for sub-forms:

- Form groups can have their own validation:

```tsx
<form.FormGroup
  name="step1"
  validators={{ onChange: () => 'Error' }}
  children={(group) => {
    group.state.meta.errorMap // {onChange: "Error" | undefined}
    group.state.meta.errors // ("Error")[]
  }}
/>
```

- Can set errors on sub-fields:

```tsx
<form.FormGroup
  name="step1"
  validators={{
    onChange: ({ value, groupApi }) => ({
      group: value.name === 'error' ? 'Group error' : undefined,
      fields: {
        // Must use the name of the field relative to the FormGroup as the error key,
        // to stay consistent with how standard schema works with form groups
        name: value.name === 'error' ? 'Field error' : undefined,
      },
    }),
  }}
/>
```

- And can even accept standard schemas:

```tsx
<form.FormGroup
  name="step1"
  validators={{
    onChange: z.object({
      name: z.string().min(2),
    }),
  }}
/>
```

> The reason we don't use the full path names for fields is so that you can compose your schemas like so:
>
> ```
> const step1Schema = z.object({
>     name: z.string().min(2)
> })
>
> const schema = z.object({
>     step1: step1Schema,
>     step2: step2Schema
> })
> ```
>
> And pass the `step1Schema` to a form group and `schema` to the parent form. That way, partially validated data will still flag errors if the group is bypassed.

### Dynamic Group Validation

If you want to use [dynamic validation (`onDynamic`)](./dynamic-validation.md) with a form group, do not rely on the `onDynamic` validator passed to `useForm`:

```tsx
useForm({
  validationLogic: revalidateLogic(),
  validators: {
    // This validator will not run `onChange` when a sub-form is submitted;
    // it will only run `onChange` when the form itself is submitted.
    onDynamic: schema,
  },
})
```

Instead, pass your sub-schema for the group to the `onDynamic` validation of the `FormGroup` itself:

```tsx
<form.FormGroup validators={{ onDynamic: step1Schema }} />
```

It will treat `group.submissionAttempts` as the way to change what validator is ran before/after submit.

## Form Group State

Just like you're able to access `group.state.meta.errors`, you're also able to access the group's value using `group.state.value`. Likewise, here are some valuable properties you can access in the `group.state.meta`:

- `group.state.meta.isFieldsValid`: `true` when the field-level validators have no errors
- `group.state.meta.isGroupValid`: `true` when the group-level validators have no errors
- `group.state.meta.isValid`: `true` when both the field-level and group-level validators have no errors
- `group.state.meta.isSubmitting`: `true` when the group is in the process of being submitted

# Example
[github link](https://github.com/TanStack/form/tree/form-group/examples/react/multi-step-wizard/src/features/wizard)

```tsx
// page.tsx
import { revalidateLogic } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { useAppForm } from '../../hooks/form.tsx'
import { step1Schema, step2Schema, wizardFormOpts } from './shared-form.tsx'
import { Step2Form } from './step2-subform.tsx'
import { Step1Form } from './step1-subform.tsx'

export const WizardPage = () => {
  const [step, setStep] = useState(0)
  const form = useAppForm({
    ...wizardFormOpts,
    validationLogic: revalidateLogic(),
    validators: {
      // onDynamic is only used when `form.handleSubmit` is called itself.
      // When `form.FormGroup`'s `handleSubmit` is called, it will only validate the current step's schema.
      // This means that this schema will not be called when the user submits the form group, but instead when they submit the entire form.
      onDynamic: z.object({
        step1: step1Schema,
        step2: step2Schema,
      }),
    },
    onSubmit: ({ value }) => {
      alert(`Form submitted: ${JSON.stringify(value)}`)
    },
  })

  return (
    <>
      {step === 0 && <Step1Form form={form} step={step} setStep={setStep} />}
      {step === 1 && <Step2Form form={form} step={step} setStep={setStep} />}
    </>
  )
}
```

```tsx
// shared-form.tsx
import { formOptions } from '@tanstack/react-form'
import z from 'zod'

export const step1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const step2Schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
})

export const wizardFormOpts = formOptions({
  defaultValues: {
    step1: {
      name: '',
    },
    step2: {
      name: '',
    },
  },
})
```
```tsx
// step1-subForm.tsx
import { withForm } from '../../hooks/form'
import { step1Schema, wizardFormOpts } from './shared-form'

export const Step1Form = withForm({
  ...wizardFormOpts,
  props: {
    step: 0,
    setStep: (_step: number) => {},
  },
  render: function Render({ form, step, setStep }) {
    return (
      <form.FormGroup
        name="step1"
        validators={{
          onDynamic: step1Schema,
        }}
        onGroupSubmit={({ value: _value }) => {
          setStep(step + 1)
        }}
        onGroupSubmitInvalid={() => {
          // Just like a form, you can also handle invalid submits at the group level, which is useful for multi-step wizards to prevent going to the next step if the current step is invalid
        }}
      >
        {(formGroup) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              formGroup.handleSubmit()
            }}
          >
            <form.AppField name="step1.name">
              {(field) => <field.TextField label="Step 1 Name" />}
            </form.AppField>

            <form.AppForm>
              <form.SubscribeButton label="Submit" />
            </form.AppForm>
            {/* formGroup contains errorMaps and errors, just like forms and fields */}
            <pre>{JSON.stringify(formGroup.state.meta.errorMap, null, 2)}</pre>
          </form>
        )}
      </form.FormGroup>
    )
  },
})
```

```tsx
// step2-subForm.tsx
import { withForm } from '../../hooks/form'
import { step2Schema, wizardFormOpts } from './shared-form'

export const Step2Form = withForm({
  ...wizardFormOpts,
  props: {
    step: 1,
    setStep: (_step: number) => {},
  },
  render: function Render({ form, step, setStep }) {
    return (
      <form.FormGroup
        name="step2"
        validators={{
          onDynamic: step2Schema,
        }}
        onGroupSubmit={({ value: _value }) => {
          form.handleSubmit()
        }}
      >
        {(formGroup) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              formGroup.handleSubmit()
            }}
          >
            <form.AppField name="step2.name">
              {(field) => <field.TextField label="Step 2 Name" />}
            </form.AppField>

            <button onClick={() => setStep(step - 1)}>Back</button>
            <form.AppForm>
              <form.SubscribeButton label="Submit" />
            </form.AppForm>
          </form>
        )}
      </form.FormGroup>
    )
  },
})
```
