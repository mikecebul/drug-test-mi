'use client'

import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { formatSubstance } from '@/lib/substances'

interface ConfirmationSubstanceSelectorProps {
  unexpectedPositives: string[]
  selectedSubstances: string[]
  onSelectionChange: (substances: string[]) => void
}

export function ConfirmationSubstanceSelector({
  unexpectedPositives,
  selectedSubstances,
  onSelectionChange,
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
    <div className="border-muted bg-card space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Select Substances for Confirmation</Label>
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

      <div className="grid grid-cols-2 gap-2">
        {unexpectedPositives.map((substance) => (
          <div key={substance} className="flex items-center space-x-2">
            <Checkbox
              id={`confirm-${substance}`}
              checked={selectedSubstances.includes(substance)}
              onCheckedChange={() => toggleSubstance(substance)}
            />
            <Label htmlFor={`confirm-${substance}`} className="cursor-pointer text-sm font-normal">
              {formatSubstance(substance)}
            </Label>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Selected: {selectedSubstances.length} of {unexpectedPositives.length} substances
      </p>
    </div>
  )
}
