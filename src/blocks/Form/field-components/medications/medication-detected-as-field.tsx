'use client'

import { useFieldContext } from '../../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/utilities/cn'
import { DRUG_TEST_SUBSTANCES } from '@/app/dashboard/medications/constants/drugTestSubstances'

interface MedicationDetectedAsFieldProps {
  isLocked?: boolean
}

export default function MedicationDetectedAsField({ isLocked = false }: MedicationDetectedAsFieldProps) {
  const field = useFieldContext<string[]>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  const selectedValues = field.state.value || []

  const toggleSubstance = (value: string) => {
    const current = selectedValues as string[]
    if (current.includes(value)) {
      field.handleChange(current.filter((v) => v !== value))
    } else {
      field.handleChange([...current, value])
    }
  }

  return (
    <Field>
      <FieldContent>
        <FieldLabel>Detected As (on drug test)</FieldLabel>
        <div
          id={field.name}
          className="border-border grid grid-cols-2 gap-2 rounded-md border p-3"
          tabIndex={-1}
          aria-invalid={hasErrors || undefined}
        >
          {DRUG_TEST_SUBSTANCES.map((substance) => (
            <Field
              key={substance.value}
              orientation="horizontal"
              className={cn(
                'hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm transition-colors',
                isLocked && 'cursor-not-allowed opacity-50',
              )}
            >
              <Checkbox
                id={`${field.name}-${substance.value}`}
                checked={selectedValues.includes(substance.value)}
                onCheckedChange={() => toggleSubstance(substance.value)}
                disabled={isLocked}
              />
              <FieldLabel htmlFor={`${field.name}-${substance.value}`} className="cursor-pointer text-sm font-normal">
                {substance.label}
              </FieldLabel>
            </Field>
          ))}
        </div>
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
