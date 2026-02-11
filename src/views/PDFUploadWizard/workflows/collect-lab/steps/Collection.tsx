'use client'

import React from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { useStore } from '@tanstack/react-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { HeadshotCaptureCard } from '../../components'
import { getCollectLabFormOpts } from '../shared-form'
import { collectionSchema, labTests } from '../validators'
import InputDateTimePicker from '@/components/input-datetime-picker'

const TEST_LABELS: Record<(typeof labTests)[number], string> = {
  '11-panel-lab': '11-Panel',
  '17-panel-sos-lab': '17-Panel SOS',
  'etg-lab': 'EtG',
}

export const CollectionStep = withForm({
  ...getCollectLabFormOpts('collection'),

  render: function Render({ form }) {
    // Access breathalyzerTaken value for conditional rendering
    const breathalyzerTaken = useStore(form.store, (state) => state.values.collection.breathalyzerTaken)

    // Access collectionDate value for the date picker
    const collectionDateValue = useStore(form.store, (state) => state.values.collection.collectionDate)
    const collectionDateTime = collectionDateValue ? new Date(collectionDateValue) : undefined

    // Access client for the editable info card
    const formClient = useStore(form.store, (state) => state.values.client)
    const client = formClient?.id
      ? {
          ...formClient,
          middleInitial: formClient.middleInitial ?? undefined,
          dob: formClient.dob ?? undefined,
          headshot: formClient.headshot ?? undefined,
          headshotId: formClient.headshotId ?? undefined,
          fullName: formClient.middleInitial
            ? `${formClient.firstName} ${formClient.middleInitial} ${formClient.lastName}`
            : `${formClient.firstName} ${formClient.lastName}`,
          initials: `${formClient.firstName.charAt(0)}${formClient.lastName.charAt(0)}`,
        }
      : undefined

    return (
      <div className="space-y-8">
        <FieldGroupHeader title="Collection Details" description="Verify the collection details are correct." />

        {client && (
          <HeadshotCaptureCard
            client={client}
            onHeadshotLinked={(url: string, docId: string) => {
              form.setFieldValue('client.headshot', url)
              form.setFieldValue('client.headshotId', docId)
            }}
          />
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Test Type Selection */}
              <form.Field name="collection.testType">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel>Lab Test Type</FieldLabel>
                    <RadioGroup
                      defaultValue="11-panel-lab"
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as any)}
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      {labTests.map((test) => (
                        <div key={test} className="flex items-center space-x-2">
                          <RadioGroupItem value={test} id={test} />
                          <FieldLabel htmlFor={test} className="text-base font-light">
                            {TEST_LABELS[test]}
                          </FieldLabel>
                        </div>
                      ))}
                    </RadioGroup>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              {/* Collection Date & Time */}
              <form.AppField name="collection.collectionDate">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0} className="max-w-sm">
                    <InputDateTimePicker
                      id="collection-date"
                      label="Collection Date & Time"
                      value={collectionDateTime}
                      onChange={(date) => field.handleChange(date?.toISOString() || '')}
                      placeholder="Select date"
                      required
                      aria-invalid={field.state.meta.errors.length > 0}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.AppField>

              {/* Breathalyzer Section */}
              <FieldSet>
                <FieldLegend>Breathalyzer Test (Optional)</FieldLegend>
                <form.Field name="collection.breathalyzerTaken">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Checkbox
                        id="breathalyzerTaken"
                        checked={field.state.value}
                        onCheckedChange={(checked) => {
                          field.handleChange(checked as boolean)
                          // Clear result when unchecking - validation errors clear automatically
                          if (!checked) {
                            form.setFieldValue('collection.breathalyzerResult', null)
                          }
                        }}
                      />
                      <FieldLabel htmlFor="breathalyzerTaken" className="cursor-pointer font-normal">
                        Breathalyzer test was administered
                      </FieldLabel>
                    </Field>
                  )}
                </form.Field>
              </FieldSet>
              {breathalyzerTaken && (
                <form.Field
                  name="collection.breathalyzerResult"
                  validators={{
                    onChange: collectionSchema.shape.collection.shape.breathalyzerResult,
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor="breathalyzerResult">BAC Result</FieldLabel>
                      <Input
                        type="number"
                        step="0.001"
                        id="breathalyzerResult"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0.000"
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      <FieldDescription>
                        Enter result with up to 3 decimal places. Threshold: 0.000 (any detectable alcohol = positive)
                      </FieldDescription>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
})
