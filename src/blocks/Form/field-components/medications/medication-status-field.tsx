'use client'

import { useFieldContext } from '../../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/utilities/cn'

interface MedicationStatusFieldProps {
  isLocked?: boolean
}

export default function MedicationStatusField({ isLocked = false }: MedicationStatusFieldProps) {
  const field = useFieldContext<'active' | 'discontinued'>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = errors.length > 0

  return (
    <Field data-invalid={hasErrors}>
      <FieldContent>
        <FieldLabel>Status *</FieldLabel>
        <Select
          value={field.state.value ?? 'active'}
          onValueChange={(value) => field.handleChange(value as 'active' | 'discontinued')}
          disabled={isLocked}
        >
          <SelectTrigger className={cn(isLocked && 'cursor-not-allowed opacity-50')} aria-invalid={hasErrors || undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="discontinued">Discontinued</SelectItem>
          </SelectContent>
        </Select>
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
