'use client'

import { useFieldContext } from '../../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/utilities/cn'

interface MedicationStatusFieldProps {
  isLocked?: boolean
  onStatusChange?: (status: 'active' | 'discontinued') => void
}

export default function MedicationStatusField({ isLocked = false, onStatusChange }: MedicationStatusFieldProps) {
  const field = useFieldContext<'active' | 'discontinued'>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = errors.length > 0
  const fieldId = field.name

  return (
    <Field data-invalid={hasErrors || undefined} data-disabled={isLocked || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={fieldId}>Status *</FieldLabel>
        <Select
          items={[
            { value: 'active', label: 'Active' },
            { value: 'discontinued', label: 'Discontinued' },
          ]}
          value={field.state.value ?? 'active'}
          onValueChange={(value) => {
            const status = value as 'active' | 'discontinued'
            field.handleChange(status)
            onStatusChange?.(status)
          }}
          disabled={isLocked}
        >
          <SelectTrigger
            id={fieldId}
            className={cn(isLocked && 'cursor-not-allowed opacity-50')}
            aria-invalid={hasErrors || undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
