'use client'

import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../hooks/form-context'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { cn } from '@/utilities/cn'

export interface PhoneFieldUIProps {
  label?: string | null
  colSpan?: '1' | '2'
  required?: boolean | null
}

export default function PhoneField({ label, colSpan, required }: PhoneFieldUIProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <div className={cn('col-span-2 w-full', { '@lg:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          type="text"
          value={field.state.value ?? ''}
          onBlur={() => field.handleBlur()}
          onChange={(e) => field.handleChange(e.target.value)}
          autoComplete="tel"
          aria-invalid={hasErrors || undefined}
        />
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
