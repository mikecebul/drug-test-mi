'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getCollectLabFormOpts } from '../../shared-form'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { ClientDisplayCard } from '../../components/ClientDisplayCard'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/utilities/cn'
import { MedicationCardHeader } from './MedicationCardHeader'
import { getTodayDateString, getClientMedications } from './helpers'

// Motion wrapper for smooth animations
const MedicationMotionWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ marginBottom: 0 }}
    animate={{ marginBottom: 12 }}
    exit={{ marginBottom: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={{
        opacity: { duration: 0.05, delay: 0.15 },
        height: { duration: 0.2 },
      }}
    >
      {children}
    </motion.div>
  </motion.div>
)

export const MedicationsStep = withForm({
  ...getCollectLabFormOpts('medications'),

  render: function Render({ form }) {
    const client = useStore(form.store, (state) => state.values.client)

    const {
      data: medications,
      isLoading,
      refetch,
    } = useQuery({
      queryKey: ['medications', client.id],
      queryFn: () => getClientMedications(client.id),
      staleTime: Infinity,
      enabled: !!client.id,
    })

    const handleRefresh = async () => {
      const result = await refetch()
      if (result.data) {
        form.setFieldValue('medications', result.data as any)
      }
    }

    // Initialize form only when empty
    useEffect(() => {
      const formMeds = form.getFieldValue('medications')
      const formIsEmpty = !formMeds || formMeds.length === 0
      if (formIsEmpty && medications && medications.length > 0) {
        form.setFieldValue('medications', medications as any)
      }
    }, [medications, form])

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
        <ClientDisplayCard client={client} selected />

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
              <form.Field name="medications" mode="array">
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
                              <form.Subscribe
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
                                            <form.AppField name={`medications[${i}].medicationName`}>
                                              {(f) => <f.MedicationNameField isLocked={isLocked} />}
                                            </form.AppField>

                                            <div className="grid grid-cols-2 gap-4">
                                              <form.AppField name={`medications[${i}].startDate`}>
                                                {(f) => (
                                                  <f.MedicationDateField
                                                    label="Start Date"
                                                    isLocked={isLocked}
                                                    required
                                                  />
                                                )}
                                              </form.AppField>

                                              <form.AppField name={`medications[${i}].endDate`}>
                                                {(f) => <f.MedicationDateField label="End Date" isLocked={isLocked} />}
                                              </form.AppField>
                                            </div>

                                            <form.AppField name={`medications[${i}].status`}>
                                              {(f) => <f.MedicationStatusField isLocked={isLocked} />}
                                            </form.AppField>

                                            <form.AppField name={`medications[${i}].detectedAs`}>
                                              {(f) => <f.MedicationDetectedAsField isLocked={isLocked} />}
                                            </form.AppField>

                                            <form.AppField name={`medications[${i}].requireConfirmation`}>
                                              {(f) => <f.MedicationRequireConfirmationField isLocked={isLocked} />}
                                            </form.AppField>

                                            <form.AppField name={`medications[${i}].notes`}>
                                              {(f) => <f.MedicationNotesField isLocked={isLocked} />}
                                            </form.AppField>
                                          </div>
                                        </CollapsiblePanel>
                                      </Collapsible>
                                    </Card>
                                  )
                                }}
                              </form.Subscribe>
                            </MedicationMotionWrapper>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </form.Field>
            )}
          </CardContent>
        </Card>
      </div>
    )
  },
})
