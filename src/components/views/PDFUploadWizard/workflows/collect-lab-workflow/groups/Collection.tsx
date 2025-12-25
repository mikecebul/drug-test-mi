'use client'

import React from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { useStore } from '@tanstack/react-form'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { wizardContainerStyles } from '../../../styles'
import { cn } from '@/utilities/cn'
import { collectLabFormOpts } from '../shared-form'

export const CollectionGroup = withForm({
  ...collectLabFormOpts,
  props: {
    title: 'Collection Details',
    description: '',
  },

  render: function Render({ form, title, description }) {
    // Access breathalyzerTaken value for conditional rendering
    const breathalyzerTaken = useStore(
      form.store,
      (state) => state.values.collection.breathalyzerTaken,
    )

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />
        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Test Type Selection */}
                <form.Field name="collection.testType">
                  {(field) => (
                    <div className="space-y-3">
                      <Label>Test Type *</Label>
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as any)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="11-panel-lab" id="11-panel" />
                          <Label htmlFor="11-panel" className="cursor-pointer font-normal">
                            11-Panel Lab Test
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="17-panel-sos-lab" id="17-panel-sos" />
                          <Label htmlFor="17-panel-sos" className="cursor-pointer font-normal">
                            17-Panel SOS Lab Test
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="etg-lab" id="etg" />
                          <Label htmlFor="etg" className="cursor-pointer font-normal">
                            EtG Lab Test
                          </Label>
                        </div>
                      </RadioGroup>
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-destructive text-sm">
                          {field.state.meta.errors[0]?.message}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                {/* Collection Date */}
                <form.Field name="collection.collectionDate">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="collectionDate">Collection Date *</Label>
                      <Input
                        id="collectionDate"
                        type="date"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-destructive text-sm">
                          {field.state.meta.errors[0]?.message}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                {/* Collection Time */}
                <form.Field name="collection.collectionTime">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="collectionTime">Collection Time *</Label>
                      <Input
                        id="collectionTime"
                        type="time"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-destructive text-sm">
                          {field.state.meta.errors[0]?.message}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                {/* Breathalyzer Section */}
                <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
                  <h3 className="text-sm font-medium">Breathalyzer Test (Optional)</h3>

                  <form.Field name="collection.breathalyzerTaken">
                    {(field) => (
                      <div className="flex items-center space-x-2">
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
                        <Label htmlFor="breathalyzerTaken" className="cursor-pointer font-normal">
                          Breathalyzer test was administered
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  {breathalyzerTaken && (
                    <form.Field name="collection.breathalyzerResult">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="breathalyzerResult">
                            BAC Result <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max="1"
                            id="breathalyzerResult"
                            value={field.state.value ?? ''}
                            onChange={(e) =>
                              field.handleChange(e.target.value ? parseFloat(e.target.value) : null)
                            }
                            onBlur={field.handleBlur}
                            placeholder="0.000"
                          />
                          <p className="text-muted-foreground text-xs">
                            Enter result with 3 decimal places. Threshold: 0.000 (any detectable
                            alcohol = positive)
                          </p>
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-destructive text-sm">
                              {field.state.meta.errors[0]?.message}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
})
