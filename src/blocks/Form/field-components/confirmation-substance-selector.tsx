'use client'

import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { formatSubstance } from '@/lib/substances'

interface ConfirmationSubstanceSelectorProps {
  unexpectedPositives: string[]
  selectedSubstances: string[]
  onSelectionChange: (substances: string[]) => void
  error?: string
}

export function ConfirmationSubstanceSelector({
  unexpectedPositives,
  selectedSubstances,
  onSelectionChange,
  error,
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
    <FieldSet className="border-muted bg-card space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <FieldLegend variant="label">Select Substances for Confirmation</FieldLegend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-primary text-xs hover:underline"
          >
            Select All
          </button>
          <span className="text-muted-foreground text-xs">|</span>
          <button
            type="button"
            onClick={selectNone}
            className="text-primary text-xs hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      <FieldGroup className="grid grid-cols-2 gap-2">
        {unexpectedPositives.map((substance) => (
          <Field key={substance} orientation="horizontal">
            <Checkbox
              id={`confirm-${substance}`}
              checked={selectedSubstances.includes(substance)}
              onCheckedChange={() => toggleSubstance(substance)}
            />
            <FieldLabel htmlFor={`confirm-${substance}`} className="cursor-pointer text-sm font-normal">
              {formatSubstance(substance)}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>

      <FieldDescription className="text-xs">
        Selected: {selectedSubstances.length} of {unexpectedPositives.length} substances
      </FieldDescription>

      <FieldError>{error}</FieldError>
    </FieldSet>
  )
}
