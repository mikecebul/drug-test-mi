'use client'

import React from 'react'
import { useFieldContext } from '../hooks/form-context'
import { Checkbox } from '@/components/ui/checkbox'
import { getSubstanceOptions, type SubstanceValue } from '@/fields/substanceOptions'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'

interface SubstanceChecklistFieldProps {
  label?: string
  description?: string
  required?: boolean
  testType?: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
}

export default function SubstanceChecklistField({
  label = 'Detected Substances',
  description = 'Select all substances that tested positive. Leave unchecked for negative results.',
  required = false,
  testType = '15-panel-instant',
}: SubstanceChecklistFieldProps) {
  const field = useFieldContext<SubstanceValue[]>()

  const selectedSubstances = field.state.value || []

  // Get substance options based on test type
  const substanceOptions = getSubstanceOptions(testType)

  const toggleSubstance = (substance: SubstanceValue) => {
    const isSelected = selectedSubstances.includes(substance)
    if (isSelected) {
      field.handleChange(selectedSubstances.filter((s) => s !== substance))
    } else {
      field.handleChange([...selectedSubstances, substance])
    }
  }

  return (
    <div className="space-y-2 pb-2">
      {label && (
        <FieldLegend className="mb-0">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FieldLegend>
      )}
      {description && <p className="text-muted-foreground">{description}</p>}

      {/* <FieldGroup className="border-border grid grid-cols-2 gap-3 overflow-y-auto rounded-lg border p-4"> */}
      <FieldGroup className="border-border rounded-lg border p-4">
        <FieldSet className="grid grid-cols-2 gap-3">
          {substanceOptions.map((substance) => (
            <Field key={substance.value} orientation="horizontal">
              <Checkbox
                id={`${field.name}-${substance.value}`}
                checked={selectedSubstances.includes(substance.value)}
                onCheckedChange={() => toggleSubstance(substance.value)}
              />
              <FieldLabel htmlFor={`${field.name}-${substance.value}`} className="cursor-pointer font-normal">
                {substance.label}
              </FieldLabel>
            </Field>
          ))}
        </FieldSet>
      </FieldGroup>

      <p className="text-muted-foreground text-sm">Selected: {selectedSubstances.length} positive result(s)</p>

      {field.state.meta.errors.length > 0 && (
        <p className="text-destructive text-sm">{String(field.state.meta.errors[0])}</p>
      )}
    </div>
  )
}
