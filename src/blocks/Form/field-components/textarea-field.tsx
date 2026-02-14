'use client'

import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../hooks/form-context'
import { cn } from '@/utilities/cn'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

export interface TextareaFieldUIProps {
  label?: string | null
  placeholder?: string | null
  description?: string | null
  colSpan?: '1' | '2'
  required?: boolean | null
}

export default function TextareaField({ label, placeholder, description, colSpan, required }: TextareaFieldUIProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <div className={cn('col-span-2 w-full', { '@md:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>
        <Textarea
          id={field.name}
          name={field.name}
          value={field.state.value ?? ''}
          onBlur={() => field.handleBlur()}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder || undefined}
          required={!!required}
          autoComplete="off"
          aria-invalid={hasErrors || undefined}
        />
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
