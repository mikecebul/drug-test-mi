'use client'

import { useFieldContext } from '../../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utilities/cn'

interface MedicationNotesFieldProps {
  isLocked?: boolean
}

export default function MedicationNotesField({ isLocked = false }: MedicationNotesFieldProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = errors.length > 0

  return (
    <Field data-invalid={hasErrors}>
      <FieldContent>
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          value={field.state.value || ''}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder="Additional notes about this medication"
          className={cn('min-h-20', isLocked && 'cursor-not-allowed opacity-50')}
          disabled={isLocked}
          aria-invalid={hasErrors || undefined}
        />
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
