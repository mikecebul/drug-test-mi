'use client'

import { useFieldContext } from '../../hooks/form-context'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utilities/cn'

interface MedicationNotesFieldProps {
  isLocked?: boolean
}

export default function MedicationNotesField({ isLocked = false }: MedicationNotesFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Field>
      <FieldContent>
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          value={field.state.value || ''}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder="Additional notes about this medication"
          className={cn('min-h-20', isLocked && 'cursor-not-allowed opacity-50')}
          disabled={isLocked}
        />
      </FieldContent>
    </Field>
  )
}
