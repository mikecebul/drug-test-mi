'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'

interface ConfirmationSubstanceSelectorProps {
  unexpectedPositives: string[]
  selectedSubstances: string[]
  onSelectionChange: (substances: string[]) => void
  error?: string
  compact?: boolean
  invalid?: boolean
  disabled?: boolean
}

export function ConfirmationSubstanceSelector({
  unexpectedPositives,
  selectedSubstances,
  onSelectionChange,
  error,
  invalid = false,
  compact = false,
  disabled = false,
}: ConfirmationSubstanceSelectorProps) {
  const id = React.useId()
  const toggleSubstance = (substance: string) => {
    if (selectedSubstances.includes(substance)) {
      onSelectionChange(selectedSubstances.filter((s) => s !== substance))
    } else {
      onSelectionChange([...selectedSubstances, substance])
    }
  }

  const selectAll = () => {
    onSelectionChange(unexpectedPositives)
  }

  const selectNone = () => {
    onSelectionChange([])
  }

  return (
    <FieldSet
      disabled={disabled}
      data-invalid={invalid}
      className={cn('gap-3', !compact && 'border-muted bg-card rounded-md border p-4')}
    >
      <FieldLegend variant="label" className="mb-0 flex items-center justify-between gap-3">
        <span>{compact ? 'Confirm substances' : 'Select Substances for Confirmation'}</span>
        {(!compact || unexpectedPositives.length > 1) && (
          <div className="flex gap-2">
            <Button type="button" variant="link" size="sm" onClick={selectAll} disabled={disabled}>
              Select All
            </Button>
            <Button type="button" variant="link" size="sm" onClick={selectNone} disabled={disabled}>
              Clear
            </Button>
          </div>
        )}
      </FieldLegend>

      <FieldGroup className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {unexpectedPositives.map((substance, index) => (
          <Field key={substance} orientation="horizontal">
            <Checkbox
              id={`${id}-confirm-${substance}`}
              disabled={disabled}
              checked={selectedSubstances.includes(substance)}
              onCheckedChange={() => toggleSubstance(substance)}
              aria-invalid={index === 0 ? invalid : undefined}
            />
            <FieldLabel htmlFor={`${id}-confirm-${substance}`} className="cursor-pointer text-sm font-normal">
              {formatSubstance(substance)}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>

      {!compact && (
        <FieldDescription className="text-xs">
          Selected: {selectedSubstances.length} of {unexpectedPositives.length} substances
        </FieldDescription>
      )}

      <FieldError>{error}</FieldError>
    </FieldSet>
  )
}
