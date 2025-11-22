'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import InputDateTimePicker from '@/components/input-datetime-picker'
import MedicationDisplayField from '@/blocks/Form/field-components/medication-display-field'
import { getClientMedications } from '../actions'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { TestType } from '../types'

const defaultValues = {
  testType: '15-panel-instant' as TestType,
  collectionDate: '',
  detectedSubstances: [] as SubstanceValue[],
  isDilute: false,
}

export const VerifyDataFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Test Data',
    description: 'Review and adjust the extracted data before creating the test record',
  },

  render: function Render({ group, title, description }) {
    const [medications, setMedications] = useState<Array<{ name: string; detectedAs: string[] }>>(
      [],
    )

    // Get client and parsed data from form
    const formValues = useStore(group.form.store, (state) => state.values)
    const client = (formValues as any).clientData
    const extractData = (formValues as any).extractData

    // Initialize form with extracted data
    useEffect(() => {
      if (extractData?.collectionDate) {
        group.setFieldValue('collectionDate', extractData.collectionDate.toISOString())
      }
      if (extractData?.detectedSubstances) {
        group.setFieldValue('detectedSubstances', extractData.detectedSubstances)
      }
      if (extractData?.isDilute !== undefined) {
        group.setFieldValue('isDilute', extractData.isDilute)
      }
    }, [extractData])

    // Fetch medications
    useEffect(() => {
      async function fetchMedications() {
        if (!client?.id) return

        const result = await getClientMedications(client.id)
        setMedications(result.medications)
      }
      fetchMedications()
    }, [client?.id])

    const collectionDateValue = useStore(group.store, (state) => state.values.collectionDate)
    const collectionDateTime = collectionDateValue ? new Date(collectionDateValue) : undefined

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-blue-900 dark:text-blue-100">
                Client
              </CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                {client?.lastName}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{client?.email}</p>
              {client?.dob && (
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  DOB: {new Date(client.dob).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          {medications.length > 0 && <MedicationDisplayField medications={medications} />}
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <group.AppField name="testType">
              {(field) => (
                <field.SelectField
                  label="Test Type"
                  options={[
                    { value: '15-panel-instant', label: '15-Panel Instant' },
                    { value: '11-panel-lab', label: '11-Panel Lab' },
                    { value: '17-panel-sos-lab', label: '17-Panel SOS Lab' },
                    { value: 'etg-lab', label: 'EtG Lab' },
                  ]}
                  required
                />
              )}
            </group.AppField>

            <group.AppField name="collectionDate">
              {(field) => (
                <div className="space-y-2">
                  <InputDateTimePicker
                    id="collection-date"
                    label="Collection Date & Time"
                    value={collectionDateTime}
                    onChange={(date) => field.handleChange(date?.toISOString() || '')}
                    placeholder="Select date"
                    required
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </group.AppField>

            <group.AppField name="isDilute">
              {(field) => <field.CheckboxField label="Dilute Sample" />}
            </group.AppField>

            <group.AppField name="detectedSubstances">
              {(field) => <field.SubstanceChecklistField />}
            </group.AppField>
          </CardContent>
        </Card>
      </div>
    )
  },
})
