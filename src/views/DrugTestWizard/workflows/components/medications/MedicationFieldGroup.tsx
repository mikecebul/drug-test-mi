'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/utilities/cn'
import { MedicationCardHeader } from './MedicationCardHeader'
import { createMedicationUIId, getTodayDateString, type MedicationWithUIState } from './helpers'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { MedicationMotionWrapper } from './MedicationWrapper'
import { FieldGroupHeader } from '../FieldGroupHeader'
import { ClientDetailsCard, type ClientDetailsValue } from '../client/ClientDetailsCard'
import type { FormClient } from '../../shared-validators'

// Default values for a single medication
const defaultValues = {
  medications: [] as MedicationWithUIState[],
}

function MedicationEditorCard({
  children,
  defaultOpen,
  hasErrors,
  isLocked,
  medicationName,
  trigger,
}: {
  children: ReactNode
  defaultOpen: boolean
  hasErrors: boolean
  isLocked: boolean
  medicationName: string
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card
      role="group"
      aria-label={`Medication: ${medicationName || 'New Medication'}`}
      onFocusCapture={() => {
        if (hasErrors && !open) {
          setOpen(true)
        }
      }}
      className={cn(
        'transition-all duration-200',
        isLocked && 'bg-muted/30 opacity-60',
        hasErrors && 'border-destructive/60',
      )}
    >
      <Collapsible
        open={hasErrors || open}
        onOpenChange={(nextOpen) => {
          if (!hasErrors) {
            setOpen(nextOpen)
          }
        }}
      >
        <CollapsibleTrigger nativeButton={false} render={trigger} />
        <CollapsiblePanel>
          <div className="mt-1 flex cursor-text flex-col gap-2 rounded-sm rounded-t-none border-t p-6">{children}</div>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  )
}

export const MedicationFieldGroup = withFieldGroup({
  defaultValues,
  props: {
    client: {} as FormClient,
    isLoading: false,
    error: null as Error | null,
    handleRefresh: () => {},
    onClientUpdated: ((_client: Partial<ClientDetailsValue>) => {}) as (client: Partial<ClientDetailsValue>) => void,
  },
  render: function Render({ group, client, isLoading, error, handleRefresh, onClientUpdated }) {
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
        <ClientDetailsCard client={client} editable onClientUpdated={onClientUpdated} />

        {/* Medications Section */}
        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start justify-between gap-4 pb-4">
              <div>
                <h3 className="text-2xl font-semibold">Medications</h3>
                <p className="text-muted-foreground text-base">Review active medications before the test.</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground size-8 shrink-0"
                title="Refresh medications"
                aria-label="Refresh medications"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>

            {error ? (
              <div className="text-destructive py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                <p className="font-semibold">Failed to load medications</p>
                <p className="mt-1 text-sm">{error.message}</p>
                <Button onClick={handleRefresh} variant="outline" className="mt-4" type="button">
                  <RefreshCw className="mr-2 size-4" />
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="text-muted-foreground py-8 text-center">
                <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
                <p>Loading medications...</p>
              </div>
            ) : (
              <group.Field name="medications" mode="array">
                {(field) => (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-success/50 bg-success/10 text-success hover:bg-success/20 hover:text-success"
                        onClick={() => {
                          // The active FormGroup validates the full medications array on submit.
                          // Avoid validating shifted nested fields before React has remounted them.
                          field.insertValue(
                            0,
                            {
                              medicationName: '',
                              startDate: getTodayDateString(),
                              endDate: '',
                              status: 'active',
                              detectedAs: [],
                              requireConfirmation: false,
                              notes: '',
                              _isNew: true,
                              _wasDiscontinued: false,
                              _uiId: createMedicationUIId(),
                            },
                            { dontValidate: true },
                          )
                        }}
                      >
                        <Plus className="size-5 stroke-[2.5]" />
                        Add Medication
                      </Button>
                    </div>

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
                            <MedicationMotionWrapper
                              key={
                                med._uiId ??
                                med.createdAt ??
                                `${med.medicationName || 'medication'}-${med.startDate || i}-${i}`
                              }
                            >
                              <group.AppField name={`medications[${i}].endDate`}>
                                {(endDateField) => (
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
                                        <MedicationEditorCard
                                          defaultOpen={isNew}
                                          hasErrors={endDateField.state.meta.errors.length > 0}
                                          isLocked={isLocked}
                                          medicationName={medicationName as string}
                                          trigger={
                                            <MedicationCardHeader
                                              medicationName={medicationName as string}
                                              detectedAs={detectedAs as string[] | null}
                                              isDiscontinued={isDiscontinued}
                                              isNew={isNew}
                                              onRemove={() => field.removeValue(i)}
                                            />
                                          }
                                        >
                                          <group.AppField name={`medications[${i}].medicationName`}>
                                            {(f) => <f.MedicationNameField isLocked={isLocked} />}
                                          </group.AppField>

                                          <group.AppField name={`medications[${i}].status`}>
                                            {(f) => (
                                              <f.MedicationStatusField
                                                isLocked={isLocked}
                                                onStatusChange={(nextStatus) => {
                                                  if (nextStatus === 'active') {
                                                    endDateField.handleChange('')
                                                  }
                                                }}
                                              />
                                            )}
                                          </group.AppField>

                                          <div
                                            className={cn('grid gap-4', isDiscontinued ? 'grid-cols-2' : 'grid-cols-1')}
                                          >
                                            <group.AppField name={`medications[${i}].startDate`}>
                                              {(f) => (
                                                <f.MedicationDateField
                                                  label="Start Date"
                                                  isLocked={isLocked}
                                                  required
                                                />
                                              )}
                                            </group.AppField>

                                            {isDiscontinued ? (
                                              <endDateField.MedicationDateField
                                                label="End Date"
                                                isLocked={isLocked}
                                                required
                                              />
                                            ) : null}
                                          </div>

                                          <group.AppField name={`medications[${i}].detectedAs`}>
                                            {(f) => <f.MedicationDetectedAsField isLocked={isLocked} />}
                                          </group.AppField>
                                          <group.AppField name={`medications[${i}].requireConfirmation`}>
                                            {(f) => <f.MedicationRequireConfirmationField isLocked={isLocked} />}
                                          </group.AppField>

                                          <group.AppField name={`medications[${i}].notes`}>
                                            {(f) => <f.MedicationNotesField isLocked={isLocked} />}
                                          </group.AppField>
                                        </MedicationEditorCard>
                                      )
                                    }}
                                  </group.Subscribe>
                                )}
                              </group.AppField>
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
