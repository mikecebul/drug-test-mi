'use client'

import React from 'react'
import { useFieldContext } from '../hooks/form-context'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { panel15InstantSubstances, type SubstanceValue } from '@/fields/substanceOptions'

interface SubstanceChecklistFieldProps {
  label?: string
  description?: string
  required?: boolean
}

export default function SubstanceChecklistField({
  label = 'Detected Substances',
  description = 'Select all substances that tested positive. Leave unchecked for negative results.',
  required = false,
}: SubstanceChecklistFieldProps) {
  const field = useFieldContext<SubstanceValue[]>()

  const selectedSubstances = field.state.value || []

  const toggleSubstance = (substance: SubstanceValue) => {
    const isSelected = selectedSubstances.includes(substance)
    if (isSelected) {
      field.handleChange(selectedSubstances.filter((s) => s !== substance))
    } else {
      field.handleChange([...selectedSubstances, substance])
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto rounded-lg border p-4">
        {panel15InstantSubstances.map((substance) => (
          <div key={substance.value} className="flex items-start space-x-2">
            <Checkbox
              id={`${field.name}-${substance.value}`}
              checked={selectedSubstances.includes(substance.value)}
              onCheckedChange={() => toggleSubstance(substance.value)}
            />
            <Label
              htmlFor={`${field.name}-${substance.value}`}
              className="cursor-pointer font-normal"
            >
              {substance.label}
            </Label>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Selected: {selectedSubstances.length} positive result(s)
      </p>

      {field.state.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">{String(field.state.meta.errors[0])}</p>
      )}
    </div>
  )
}
