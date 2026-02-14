'use client'

import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../hooks/form-context'
import { cn } from '@/utilities/cn'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'

export interface CheckboxFieldUIProps {
  label?: string | null
  colSpan?: '1' | '2'
  required?: boolean | null
}

export default function CheckboxField({ label, colSpan, required }: CheckboxFieldUIProps) {
  const field = useFieldContext<boolean>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <div
      className={cn('col-span-2 flex w-full flex-col justify-start', {
        '@lg:col-span-1': colSpan === '1',
      })}
    >
      <Field orientation="horizontal" data-invalid={hasErrors}>
        <Checkbox
          id={field.name}
          checked={field.state.value ?? false}
          onBlur={() => field.handleBlur()}
          onCheckedChange={(checked) => field.handleChange(!!checked)}
          required={!!required}
          aria-invalid={hasErrors || undefined}
        />
        <FieldLabel htmlFor={field.name} className="font-normal">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>
      </Field>
      <FieldError errors={errors} />
    </div>
  )
}
