'use client'

import React from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { z } from 'zod'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Export the schema for reuse in step validation
export const collectionDetailsFieldSchema = z.object({
  testType: z.enum(['11-panel-lab', '17-panel-sos-lab', 'etg-lab']),
  collectionDate: z.string().min(1, 'Collection date is required'),
  collectionTime: z.string().min(1, 'Collection time is required'),
})

export type CollectionDetailsData = z.infer<typeof collectionDetailsFieldSchema>

const defaultValues: CollectionDetailsData = {
  testType: '11-panel-lab',
  collectionDate: new Date().toISOString().split('T')[0],
  collectionTime: new Date().toTimeString().slice(0, 5),
}

export const CollectionDetailsFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Collection Details',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-2">{description}</p>}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Test Type Selection */}
              <group.Field name="testType">
                {(field) => (
                  <div className="space-y-3">
                    <Label>Test Type *</Label>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as any)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="11-panel-lab" id="11-panel" />
                        <Label htmlFor="11-panel" className="font-normal cursor-pointer">
                          11-Panel Lab Test
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="17-panel-sos-lab" id="17-panel-sos" />
                        <Label htmlFor="17-panel-sos" className="font-normal cursor-pointer">
                          17-Panel SOS Lab Test
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="etg-lab" id="etg" />
                        <Label htmlFor="etg" className="font-normal cursor-pointer">
                          EtG Lab Test
                        </Label>
                      </div>
                    </RadioGroup>
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
                    )}
                  </div>
                )}
              </group.Field>

              {/* Collection Date */}
              <group.Field name="collectionDate">
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
                      <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
                    )}
                  </div>
                )}
              </group.Field>

              {/* Collection Time */}
              <group.Field name="collectionTime">
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
                      <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
                    )}
                  </div>
                )}
              </group.Field>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
})
