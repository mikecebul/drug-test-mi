'use client'

import { useFieldContext } from '../../hooks/form-context'
import { Field, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/utilities/cn'

interface MedicationRequireConfirmationFieldProps {
  isLocked?: boolean
}

export default function MedicationRequireConfirmationField({
  isLocked = false,
}: MedicationRequireConfirmationFieldProps) {
  const field = useFieldContext<boolean>()

  return (
    <Field orientation="horizontal">
      <Checkbox
        id={field.name}
        checked={field.state.value || false}
        onCheckedChange={(checked) => field.handleChange(checked as boolean)}
        disabled={isLocked}
        className={cn(isLocked && 'cursor-not-allowed opacity-50')}
      />
      <FieldLabel htmlFor={field.name} className={cn(isLocked && 'text-muted-foreground')}>
        Require confirmation (MAT medication)
      </FieldLabel>
    </Field>
  )
}
