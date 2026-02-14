'use client'

import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../../hooks/form-context'
import { cn } from '@/utilities/cn'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { countryOptions } from './options'

export interface CountryFieldUIProps {
  label?: string | null
  colSpan?: '1' | '2'
  required?: boolean | null
}

export default function CountryField({ label, colSpan, required }: CountryFieldUIProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <div className={cn('col-span-2 w-full', { '@lg:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name}>
          {label}
          {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <Select onValueChange={(e) => field.handleChange(e)} value={field.state.value || ''} required={!!required}>
          <SelectTrigger id={field.name} aria-invalid={hasErrors || undefined}>
            <SelectValue placeholder="Pick a country" />
          </SelectTrigger>
          <SelectContent>
            {countryOptions.map(({ label, value }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
