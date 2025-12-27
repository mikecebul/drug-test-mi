'use client'

import { useFieldContext } from '../../hooks/form-context'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/utilities/cn'

interface MedicationStatusFieldProps {
  isLocked?: boolean
}

export default function MedicationStatusField({ isLocked = false }: MedicationStatusFieldProps) {
  const field = useFieldContext<'active' | 'discontinued'>()

  return (
    <Field>
      <FieldContent>
        <FieldLabel>Status *</FieldLabel>
        <Select
          value={field.state.value ?? 'active'}
          onValueChange={(value) => field.handleChange(value as 'active' | 'discontinued')}
          disabled={isLocked}
        >
          <SelectTrigger className={cn(isLocked && 'cursor-not-allowed opacity-50')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="discontinued">Discontinued</SelectItem>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  )
}
