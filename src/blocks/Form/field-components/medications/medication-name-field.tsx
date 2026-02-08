'use client'

import { useFieldContext } from '../../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'

interface MedicationNameFieldProps {
  isLocked?: boolean
}

export default function MedicationNameField({ isLocked = false }: MedicationNameFieldProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <Field>
      <FieldContent>
        <FieldLabel>Medication Name *</FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          value={field.state.value ?? ''}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder="e.g., Ibuprofen"
          disabled={isLocked}
          className={cn(isLocked && 'cursor-not-allowed opacity-50')}
          aria-invalid={hasErrors || undefined}
        />
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
