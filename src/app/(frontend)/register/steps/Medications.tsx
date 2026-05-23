'use client'

import { useRef } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { medicationsSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'

export const MedicationsStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as {
    isFirstStep?: boolean
    isLastStep?: boolean
    isSubmitting?: boolean
    onBack?: () => void
    onNext?: () => void
    onInvalid?: () => void
  },
  render: function Render({ form, isFirstStep, isLastStep, isSubmitting, onBack, onNext, onInvalid }) {
    const medicationRowKeysRef = useRef<string[]>([])
    const nextMedicationRowKeyRef = useRef(1)
    const medications = useStore(form.store, (state) => state.values.medications)

    const createMedicationRowKey = () => {
      const key = `medication-row-${nextMedicationRowKeyRef.current}`
      nextMedicationRowKeyRef.current += 1
      return key
    }

    return (
      <form.FormGroup
        name="medications"
        validationLogic={revalidateLogic()}
        validators={{ onDynamic: medicationsSchema.shape.medications }}
        onGroupSubmit={() => onNext?.()}
        onGroupSubmitInvalid={() => onInvalid?.()}
      >
        {(group) => (
          <>
            <div className="wizard-content mb-8 flex-1 space-y-6">
              <div className="mb-6 flex items-center">
                <h2 className="text-foreground text-xl font-semibold">Medications (Optional)</h2>
              </div>

              <div className="bg-muted/60 border-border rounded-lg border p-4 text-sm text-muted-foreground">
                Only add medications you know will show positive on a drug screen (e.g., Buprenorphine for Suboxone).
                Proof of medications is handled with your referral, not MI Drug Test. This list is only to track expected
                vs unexpected positives.
              </div>

              <form.Field name="medications" mode="array">
          {(field) => {
            const rowCount = field.state.value.length

            if (medicationRowKeysRef.current.length < rowCount) {
              const missing = rowCount - medicationRowKeysRef.current.length
              for (let i = 0; i < missing; i += 1) {
                medicationRowKeysRef.current.push(createMedicationRowKey())
              }
            } else if (medicationRowKeysRef.current.length > rowCount) {
              medicationRowKeysRef.current = medicationRowKeysRef.current.slice(0, rowCount)
            }

            const handleAddMedication = () => {
              medicationRowKeysRef.current.unshift(createMedicationRowKey())
              field.insertValue(0, {
                medicationName: '',
                detectedAs: [],
              })
            }

            const handleRemoveMedication = (index: number) => {
              medicationRowKeysRef.current.splice(index, 1)
              field.removeValue(index)
            }

            return (
              <div className="space-y-4">
                <Button type="button" variant="outline" className="w-full" onClick={handleAddMedication}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Medication
                </Button>

                {medications.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    No medications added. If none apply, click Next to continue.
                  </p>
                ) : (
                  <motion.div layout className="space-y-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {medications.map((_, i) => {
                        const medicationIndex = medications.length - i
                        const medicationName = medications[i]?.medicationName?.trim() || ''
                        const medicationTitle = medicationName
                          ? `${medicationIndex} - ${medicationName}`
                          : `Medication ${medicationIndex}`

                        return (
                          <motion.div
                            key={medicationRowKeysRef.current[i] || `medication-${i}`}
                            layout
                            initial={{ opacity: 0, y: -14, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.6 }}
                          >
                            <Card className="shadow-sm">
                              <CardContent className="space-y-4 pt-6">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-foreground text-base font-semibold">{medicationTitle}</h3>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMedication(i)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                  </Button>
                                </div>

                                <form.AppField name={`medications[${i}].medicationName`}>
                                  {(medicationNameField) => <medicationNameField.MedicationNameField />}
                                </form.AppField>

                                <form.AppField name={`medications[${i}].detectedAs`}>
                                  {(detectedAsField) => <detectedAsField.MedicationDetectedAsField />}
                                </form.AppField>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            )
          }}
              </form.Field>
            </div>

            <RegisterNavigation
              isFirstStep={isFirstStep ?? false}
              isLastStep={isLastStep ?? false}
              isSubmitting={isSubmitting ?? false}
              isNextDisabled={group.state.meta.isSubmitting}
              onBack={() => onBack?.()}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    )
  },
})
