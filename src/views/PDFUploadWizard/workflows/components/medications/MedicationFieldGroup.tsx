'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/utilities/cn'
import { MedicationCardHeader } from './MedicationCardHeader'
import { getTodayDateString, type MedicationWithUIState } from './helpers'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { MedicationMotionWrapper } from './MedicationWrapper'
import { FieldGroupHeader } from '../FieldGroupHeader'
import { HeadshotDrawerCard } from '../client/HeadshotDrawerCard'
import type { FormClient } from '../../shared-validators'

// Default values for a single medication
const defaultValues = {
  medications: [] as MedicationWithUIState[],
}

export const MedicationFieldGroup = withFieldGroup({
  defaultValues,
  props: {
    client: {} as FormClient,
    isLoading: false,
    handleRefresh: () => {},
    onHeadshotLinked: ((url: string, docId: string) => {}) as (url: string, docId: string) => void,
  },
  render: function Render({ group, client, isLoading, handleRefresh, onHeadshotLinked }) {
    if (!client) {
      return (
        <div className="space-y-6">
          <FieldGroupHeader
            title="Verify Medications"
            description="Review and update the client's medications for accurate drug test interpretation"
          />
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No client selected. Please go back and select a client.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Verify Medications"
          description="Review and update the client's medications for accurate drug test interpretation"
        />
        <HeadshotDrawerCard client={client} onHeadshotLinked={onHeadshotLinked} />

        {/* Medications Section */}
        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between pb-4">
              <div>
                <h3 className="text-2xl font-semibold">Medications</h3>
                <p className="text-muted-foreground text-lg">
                  Manage medications for accurate drug test interpretation
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground p-2 transition-colors"
                title="Refresh medications"
              >
                <RefreshCw className="size-5" />
              </Button>
            </div>

            {isLoading ? (
              <div className="text-muted-foreground py-8 text-center">
                <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
                <p>Loading medications...</p>
              </div>
            ) : (
              <group.Field name="medications" mode="array">
                {(field) => (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        field.insertValue(0, {
                          medicationName: '',
                          startDate: getTodayDateString(),
                          endDate: '',
                          status: 'active',
                          detectedAs: [],
                          requireConfirmation: false,
                          notes: '',
                          _isNew: true,
                          _wasDiscontinued: false,
                        })
                      }
                    >
                      <Plus className="mr-2 size-4" />
                      Add Medication
                    </Button>

                    {field.state.value.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center">
                        No medications added yet. Click &quot;Add Medication&quot; to get started.
                      </p>
                    ) : (
                      <AnimatePresence mode="sync">
                        {field.state.value.map((med, i) => {
                          const isLocked = med._wasDiscontinued === true
                          const isNew = med._isNew === true

                          return (
                            <MedicationMotionWrapper key={`${med.medicationName || 'new'}-${med.startDate || i}-${i}`}>
                              <group.Subscribe
                                selector={(state) => [
                                  state.values.medications[i]?.status,
                                  state.values.medications[i]?.medicationName,
                                  state.values.medications[i]?.detectedAs,
                                ]}
                              >
                                {([status, medicationName, detectedAs]) => {
                                  const isDiscontinued = status === 'discontinued'
                                  return (
                                    <Card
                                      className={cn(
                                        'transition-all duration-200',
                                        isDiscontinued && 'bg-muted/30 opacity-60',
                                      )}
                                    >
                                      <Collapsible defaultOpen={isNew}>
                                        <CollapsibleTrigger
                                          nativeButton={false}
                                          render={
                                            <MedicationCardHeader
                                              medicationName={medicationName as string}
                                              detectedAs={detectedAs as string[] | null}
                                              isDiscontinued={isDiscontinued}
                                              isNew={isNew}
                                              onRemove={() => field.removeValue(i)}
                                            />
                                          }
                                        />

                                        <CollapsiblePanel>
                                          <div className="mt-1 flex cursor-text flex-col gap-2 rounded-sm rounded-t-none border-t p-6">
                                            <group.AppField name={`medications[${i}].medicationName`}>
                                              {(f) => <f.MedicationNameField isLocked={isLocked} />}
                                            </group.AppField>

                                            <div className="grid grid-cols-2 gap-4">
                                              <group.AppField name={`medications[${i}].startDate`}>
                                                {(f) => (
                                                  <f.MedicationDateField
                                                    label="Start Date"
                                                    isLocked={isLocked}
                                                    required
                                                  />
                                                )}
                                              </group.AppField>

                                              <group.AppField name={`medications[${i}].endDate`}>
                                                {(f) => <f.MedicationDateField label="End Date" isLocked={isLocked} />}
                                              </group.AppField>
                                            </div>

                                            <group.AppField name={`medications[${i}].status`}>
                                              {(f) => <f.MedicationStatusField isLocked={isLocked} />}
                                            </group.AppField>

                                            <group.AppField name={`medications[${i}].detectedAs`}>
                                              {(f) => <f.MedicationDetectedAsField isLocked={isLocked} />}
                                            </group.AppField>
                                            <group.AppField name={`medications[${i}].requireConfirmation`}>
                                              {(f) => <f.MedicationRequireConfirmationField isLocked={isLocked} />}
                                            </group.AppField>

                                            <group.AppField name={`medications[${i}].notes`}>
                                              {(f) => <f.MedicationNotesField isLocked={isLocked} />}
                                            </group.AppField>
                                          </div>
                                        </CollapsiblePanel>
                                      </Collapsible>
                                    </Card>
                                  )
                                }}
                              </group.Subscribe>
                            </MedicationMotionWrapper>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </group.Field>
            )}
          </CardContent>
        </Card>
      </div>
    )
  },
})
