import type { DefaultValues, FormField } from '../DynamicForm/use-dynamic-form-opts'
import type { DynamicFormType } from '../DynamicForm/use-dynamic-form'
import { z } from 'zod'
import { ArrayFieldComponent } from './render-array-field'
import { GroupFieldComponent } from './render-group-field'
import { RichText } from '@/components/RichText'

const getZodErrorMessage = (error: z.ZodError) => error.issues[0]?.message

export const RenderFields = ({
  field,
  defaultValues,
  form,
}: {
  field: FormField
  defaultValues: DefaultValues
  form: DynamicFormType
}) => {
  switch (field.blockType) {
    case 'message':
      if (!field.message) return <></>
      return <RichText data={field.message} enableGutter={false} className="col-span-2 text-sm" />
    case 'text':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z.string().min(1, `${field.label || field.name} is required`)
                : z.string().optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.TextField {...field} />}
        </form.AppField>
      )
    case 'email':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z.string().min(1, 'Email is required').email()
                : z.string().email().optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.EmailField {...field} />}
        </form.AppField>
      )
    case 'phone':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z
                    .string()
                    .min(1, 'Phone number required')
                    .regex(
                      /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
                      'Invalid phone number',
                    )
                : z
                    .string()
                    .regex(
                      /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
                      'Invalid phone number',
                    )
                    .optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.PhoneField {...field} />}
        </form.AppField>
      )
    case 'textarea':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z.string().min(1, `${field.label || field.name} is required`)
                : z.string().optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.TextareaField {...field} />}
        </form.AppField>
      )
    case 'checkbox':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) =>
              field.required && Boolean(value) === false
                ? field.errorMsg?.length
                  ? field.errorMsg
                  : 'Must check to continue'
                : undefined,
          }}
        >
          {(formField) => <formField.CheckboxField {...field} />}
        </form.AppField>
      )
    case 'number':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              // Start with base schema for coercing to number
              let schema = z.coerce.number()

              // Add min validation if field.min is defined
              if (field.min !== undefined && field.min !== null) {
                schema = schema.min(
                  field.min,
                  field.minError || `${field.label || field.name} must be at least ${field.min}`,
                )
              }

              // Add max validation if field.max is defined
              if (field.max !== undefined && field.max !== null) {
                schema = schema.max(
                  field.max,
                  field.maxError || `${field.label || field.name} must not exceed ${field.max}`,
                )
              }

              // Handle required vs optional
              const result = (field.required
                ? schema
                : z.union([schema, z.literal('').transform(() => undefined), z.undefined()])
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.NumberField {...field} />}
        </form.AppField>
      )
    case 'country':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z.string().min(1, `${field.label || field.name} is required`)
                : z.string().optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.CountryField {...field} />}
        </form.AppField>
      )
    case 'state':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z.string().min(1, `${field.label || field.name} is required`)
                : z.string().optional()
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.StateField {...field} />}
        </form.AppField>
      )
    case 'select':
      return (
        <form.AppField
          key={field.id}
          name={field.name}
          validators={{
            onChange: ({ value }) => {
              const result = (field.required
                ? z
                    .string()
                    .refine(
                      (value) => field.options?.some((option) => option.value === value) ?? false,
                      { message: `Please select a valid option for ${field.label || field.name}` },
                    )
                : z
                    .string()
                    .optional()
                    .refine(
                      (value) =>
                        (!value || field.options?.some((option) => option.value === value)) ?? true,
                      { message: `Please select a valid option for ${field.label || field.name}` },
                    )
              ).safeParse(value)

              return result.success ? undefined : getZodErrorMessage(result.error)
            },
          }}
        >
          {(formField) => <formField.SelectField {...field} />}
        </form.AppField>
      )
    case 'array':
      return (
        <ArrayFieldComponent
          key={field.id}
          form={form}
          field={field}
          defaultValues={defaultValues}
        />
      )
    case 'group':
      return (
        <GroupFieldComponent
          key={field.id}
          form={form}
          field={field}
          defaultValues={defaultValues}
        />
      )
    default:
      return <></>
  }
}
