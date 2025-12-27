'use client'

import { useFieldContext } from '../../hooks/form-context'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'

interface MedicationDateFieldProps {
  label: string
  isLocked?: boolean
  required?: boolean
}

export default function MedicationDateField({ label, isLocked = false, required = false }: MedicationDateFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Field>
      <FieldContent>
        <FieldLabel>
          {label}
          {required && ' *'}
        </FieldLabel>
        <Input
          type="date"
          value={field.state.value ?? ''}
          onChange={(e) => field.handleChange(e.target.value)}
          disabled={isLocked}
          className={cn(isLocked && 'cursor-not-allowed opacity-50')}
        />
        <FieldError errors={field.state.meta.errors} />
      </FieldContent>
    </Field>
  )
}
