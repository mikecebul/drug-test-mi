'use client'

import React from 'react'
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
}

export function ConfirmationSubstanceSelector({
  unexpectedPositives,
  selectedSubstances,
  onSelectionChange,
  error,
  invalid = false,
  compact = false,
}: ConfirmationSubstanceSelectorProps) {
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
    <FieldSet data-invalid={invalid} className={cn('gap-3', !compact && 'border-muted bg-card rounded-md border p-4')}>
      <FieldLegend variant="label" className="mb-0 flex items-center justify-between gap-3">
        <span>{compact ? 'Confirm substances' : 'Select Substances for Confirmation'}</span>
        {(!compact || unexpectedPositives.length > 1) && (
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-primary text-xs hover:underline">
              Select All
            </button>
            <span className="text-muted-foreground text-xs">|</span>
            <button type="button" onClick={selectNone} className="text-primary text-xs hover:underline">
              Clear
            </button>
          </div>
        )}
      </FieldLegend>

      <FieldGroup className="grid grid-cols-2 gap-2">
        {unexpectedPositives.map((substance, index) => (
          <Field key={substance} orientation="horizontal">
            <Checkbox
              id={`confirm-${substance}`}
              checked={selectedSubstances.includes(substance)}
              onCheckedChange={() => toggleSubstance(substance)}
              aria-invalid={index === 0 ? invalid : undefined}
            />
            <FieldLabel htmlFor={`confirm-${substance}`} className="cursor-pointer text-sm font-normal">
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
