'use client'

import { useFieldContext } from '../../hooks/form-context'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'

interface MedicationNameFieldProps {
  isLocked?: boolean
}

export default function MedicationNameField({ isLocked = false }: MedicationNameFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Field>
      <FieldContent>
        <FieldLabel>Medication Name *</FieldLabel>
        <Input
          value={field.state.value ?? ''}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder="e.g., Ibuprofen"
          disabled={isLocked}
          className={cn(isLocked && 'cursor-not-allowed opacity-50')}
        />
        <FieldError errors={field.state.meta.errors} />
      </FieldContent>
    </Field>
  )
}
