'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Save } from 'lucide-react'
import { allSubstanceOptions, type SubstanceValue } from '@/fields/substanceOptions'
import { formatSubstance } from '@/lib/substances'
import { toast } from 'sonner'
import type { Medication } from '@/app/dashboard/medications/types'

interface EditMedicationFormProps {
  medication: Medication
  onSubmit: (data: {
    medicationName: string
    detectedAs: SubstanceValue[]
    requireConfirmation: boolean
    notes: string
  }) => void
  onCancel: () => void
}

export function EditMedicationForm({ medication, onSubmit, onCancel }: EditMedicationFormProps) {
  const [medicationName, setMedicationName] = useState(medication.medicationName)
  const [detectedAs, setDetectedAs] = useState<SubstanceValue[]>(
    (medication.detectedAs as SubstanceValue[]) || []
  )
  const [requireConfirmation, setRequireConfirmation] = useState(
    medication.requireConfirmation || false
  )
  const [notes, setNotes] = useState(medication.notes || '')

  const handleSubmit = () => {
    if (!medicationName.trim()) {
      toast.error('Medication name is required')
      return
    }

    onSubmit({
      medicationName: medicationName.trim(),
      detectedAs,
      requireConfirmation,
      notes: notes.trim(),
    })
  }

  const toggleSubstance = (value: SubstanceValue) => {
    setDetectedAs((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Edit Medication</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="medicationName">
              Medication Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="medicationName"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="e.g., Adderall XR, Buprenorphine"
            />
          </div>

          <div className="space-y-2">
            <Label>Detected As (Optional)</Label>
            <p className="text-muted-foreground text-xs mb-2">
              Select substances this medication may show as in drug tests
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {allSubstanceOptions
                .filter((option) => option.value !== 'none')
                .map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-substance-${option.value}`}
                      checked={detectedAs.includes(option.value as SubstanceValue)}
                      onCheckedChange={() => toggleSubstance(option.value as SubstanceValue)}
                    />
                    <Label
                      htmlFor={`edit-substance-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
            </div>
            {detectedAs.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Selected: {detectedAs.map((s) => formatSubstance(s)).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="requireConfirmation"
              checked={requireConfirmation}
              onCheckedChange={(checked) => setRequireConfirmation(checked as boolean)}
            />
            <div className="space-y-1">
              <Label htmlFor="requireConfirmation" className="font-normal cursor-pointer">
                Required to test positive (Fail if missing)
              </Label>
              <p className="text-xs text-muted-foreground">
                Use this for MAT medications (buprenorphine, methadone) that must show on every test
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this medication"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
