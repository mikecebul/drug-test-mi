'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardDescriptionDiv,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { panel15InstantSubstances, type SubstanceValue } from '@/fields/substanceOptions'
import type { ParsedPDFData, ClientMatch, VerifiedTestData, TestType } from '../types'
import { getClientMedications } from '../actions'

interface VerifyDataStepProps {
  parsedData: ParsedPDFData
  client: ClientMatch
  onNext: (data: VerifiedTestData) => void
  onBack: () => void
}

export function VerifyDataStep({ parsedData, client, onNext, onBack }: VerifyDataStepProps) {
  const [medications, setMedications] = useState<Array<{ name: string; detectedAs: string[] }>>([])
  const [collectionDateTime, setCollectionDateTime] = useState<Date | undefined>(
    parsedData.collectionDate || undefined,
  )
  const [formData, setFormData] = useState<VerifiedTestData>({
    testType: '15-panel-instant',
    collectionDate: parsedData.collectionDate ? parsedData.collectionDate.toISOString() : '',
    detectedSubstances: parsedData.detectedSubstances,
    isDilute: parsedData.isDilute,
  })

  useEffect(() => {
    async function fetchMedications() {
      const result = await getClientMedications(client.id)
      setMedications(result.medications)
    }
    fetchMedications()
  }, [client.id])

  const toggleSubstance = (substance: SubstanceValue) => {
    setFormData((prev) => ({
      ...prev,
      detectedSubstances: prev.detectedSubstances.includes(substance)
        ? prev.detectedSubstances.filter((s) => s !== substance)
        : [...prev.detectedSubstances, substance],
    }))
  }

  const handleSubmit = () => {
    if (!collectionDateTime) {
      alert('Collection date and time is required')
      return
    }
    onNext({
      ...formData,
      collectionDate: collectionDateTime.toISOString(),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Verify Test Data</h2>
        <p className="text-muted-foreground">
          Review and adjust the extracted data before creating the test record
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm tracking-wide text-blue-900 uppercase">Client</CardTitle>
            <CardDescription></CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold text-blue-900">
              {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
              {client.lastName}
            </p>
            <p className="text-sm text-blue-700">{client.email}</p>
            {client.dob && (
              <p className="text-sm text-blue-700">
                DOB: {new Date(client.dob).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        {medications.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm tracking-wide text-amber-900 uppercase">
                Active Medications
              </CardTitle>
              <CardDescription className="text-amber-700">
                Expected to test positive for the following substances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <ul className="space-y-2">
                {medications.map((med, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    <div className="font-medium">
                      • {med.name}
                      {med.detectedAs.length > 0 && (
                        <span className="capitalize"> ({med.detectedAs.join(', ')})</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="test-type">Test Type</Label>
            <Select
              value={formData.testType}
              onValueChange={(value) => setFormData({ ...formData, testType: value as TestType })}
            >
              <SelectTrigger id="test-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15-panel-instant">15-Panel Instant</SelectItem>
                <SelectItem value="11-panel-lab">11-Panel Lab</SelectItem>
                <SelectItem value="17-panel-sos-lab">17-Panel SOS Lab</SelectItem>
                <SelectItem value="etg-lab">EtG Lab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <InputDateTimePicker
            id="collection-date"
            label="Collection Date & Time"
            value={collectionDateTime}
            onChange={setCollectionDateTime}
            placeholder="Select date"
            required
          />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dilute"
              checked={formData.isDilute}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isDilute: checked === true })
              }
            />
            <Label htmlFor="dilute" className="cursor-pointer font-medium">
              Dilute Sample
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Detected Substances</Label>
            <p className="text-muted-foreground text-xs">
              Select all substances that tested <strong>positive</strong>. Leave unchecked for
              negative results.
            </p>
            <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto rounded-lg border p-4">
              {panel15InstantSubstances.map((substance) => (
                <div key={substance.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={substance.value}
                    checked={formData.detectedSubstances.includes(substance.value)}
                    onCheckedChange={() => toggleSubstance(substance.value)}
                  />
                  <Label htmlFor={substance.value} className="cursor-pointer font-normal">
                    {substance.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              Selected: {formData.detectedSubstances.length} positive result(s)
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleSubmit}>Next: Confirm</Button>
      </div>
    </div>
  )
}
