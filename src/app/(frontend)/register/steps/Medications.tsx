'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'

export const MedicationsStep = withForm({
  ...getRegisterClientFormOpts('medications'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Medications (Optional)</h2>
        </div>

        <div className="bg-muted/60 border-border rounded-lg border p-4 text-sm text-muted-foreground">
          Only add medications you know will show positive on a drug screen (e.g., Buprenorphine for Suboxone). Proof of
          medications is handled with your referral, not MI Drug Test. This list is only to track expected vs unexpected
          positives.
        </div>

        <form.Field name="medications" mode="array">
          {(field) => (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  field.insertValue(0, {
                    medicationName: '',
                    detectedAs: [],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Medication
              </Button>

              {field.state.value.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No medications added. If none apply, click Next to continue.
                </p>
              ) : (
                <div className="space-y-3">
                  {field.state.value.map((_, i) => (
                    <Card key={`medication-${i}`} className="shadow-sm">
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-foreground text-base font-semibold">Medication {i + 1}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => field.removeValue(i)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </div>

                        <form.AppField name={`medications[${i}].medicationName`}>
                          {(f) => <f.MedicationNameField />}
                        </form.AppField>

                        <form.AppField name={`medications[${i}].detectedAs`}>
                          {(f) => <f.MedicationDetectedAsField />}
                        </form.AppField>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </form.Field>
      </div>
    )
  },
})
