'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { collectLabFormOpts } from '../shared-form'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { sdk } from '@/lib/payload-sdk'
import { Client } from '@/payload-types'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { Button } from '@/components/ui/button'
import { RefreshCw, Pill, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { ClientDisplayCard } from '../components/ClientDisplayCard'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'
import { DRUG_TEST_SUBSTANCES } from '@/app/dashboard/medications/constants/drugTestSubstances'

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = (): string => format(new Date(), 'yyyy-MM-dd')

// Type for medication with UI state flags
type MedicationWithUIState = {
  medicationName: string
  startDate: string
  endDate?: string | null
  status: 'active' | 'discontinued'
  detectedAs?: string[] | null
  requireConfirmation?: boolean | null
  notes?: string | null
  createdAt?: string | null
  // UI state flags (not persisted to server)
  _isNew?: boolean
  _wasDiscontinued?: boolean
}

// Helper to convert ISO date string to YYYY-MM-DD format for date inputs
const formatDateForInput = (isoDate: string | null | undefined): string => {
  if (!isoDate) return ''
  try {
    return format(parseISO(isoDate), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

// Helper to normalize medications from Payload API to form schema
const normalizeMedications = (meds: Client['medications']): MedicationWithUIState[] => {
  if (!meds) return []
  return meds.map((med) => ({
    ...med,
    startDate: formatDateForInput(med.startDate),
    endDate: formatDateForInput(med.endDate),
    _isNew: false,
    _wasDiscontinued: med.status === 'discontinued',
  }))
}

const getClientMedications = async (clientId: string) => {
  const client = await sdk.findByID({
    collection: 'clients',
    id: clientId,
  })
  return normalizeMedications(client.medications)
}

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

export const MedicationsGroup = withForm({
  ...collectLabFormOpts,

  props: {
    title: 'Verify Medications',
    description: "Review and update the client's medications for accurate drug test interpretation",
  },

  render: function Render({ form, title, description = '' }) {
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
        form.setFieldValue('medications', result.data)
      }
    }

    // Initialize form only when empty
    useEffect(() => {
      const formMeds = form.getFieldValue('medications')
      const formIsEmpty = !formMeds || formMeds.length === 0
      if (formIsEmpty && medications && medications.length > 0) {
        form.setFieldValue('medications', medications)
      }
    }, [medications, form])

    if (!client) {
      return (
        <div className="space-y-6">
          <FieldGroupHeader title={title} description={description} />
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
        <FieldGroupHeader title={title} description={description} />
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
                        No medications added yet. Click "Add Medication" to get started.
                      </p>
                    ) : (
                      <AnimatePresence mode="sync">
                        {field.state.value.map((med, i) => {
                          const isLocked = med._wasDiscontinued === true
                          const isNew = med._isNew === true

                          return (
                            <MedicationMotionWrapper
                              key={`${med.medicationName || 'new'}-${med.startDate || i}-${i}`}
                            >
                              <form.Subscribe
                                selector={(state) => state.values.medications[i]?.status}
                              >
                                {(status) => {
                                  const isDiscontinued = status === 'discontinued'
                                  return (
                                    <Card
                                      className={cn(
                                        'transition-all duration-200',
                                        isDiscontinued && 'bg-muted/30 opacity-60',
                                      )}
                                    >
                                <Collapsible defaultOpen={isNew}>
                                  {/* Header - always visible, clickable to toggle */}
                                  <CollapsibleTrigger asChild>
                                    <div className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-4 transition-colors">
                                      <div className="flex flex-1 items-center gap-3">
                                        <div
                                          className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-full',
                                            isDiscontinued ? 'bg-muted' : 'bg-primary/10',
                                          )}
                                        >
                                          <Pill
                                            className={cn(
                                              'size-5',
                                              isDiscontinued
                                                ? 'text-muted-foreground'
                                                : 'text-primary',
                                            )}
                                          />
                                        </div>
                                        <div className="flex flex-1 flex-col gap-0.5">
                                          <div className="flex items-center gap-2">
                                            <form.Subscribe
                                              selector={(state) =>
                                                state.values.medications[i]?.medicationName
                                              }
                                            >
                                              {(medicationName) => (
                                                <span
                                                  className={cn(
                                                    'text-lg font-medium',
                                                    isDiscontinued &&
                                                      'text-muted-foreground line-through',
                                                  )}
                                                >
                                                  {medicationName || 'New Medication'}
                                                </span>
                                              )}
                                            </form.Subscribe>
                                            <Badge
                                              variant={isDiscontinued ? 'secondary' : 'default'}
                                              className="ml-1"
                                            >
                                              {isDiscontinued ? 'Discontinued' : 'Active'}
                                            </Badge>
                                          </div>
                                          {med.detectedAs &&
                                            Array.isArray(med.detectedAs) &&
                                            med.detectedAs.length > 0 && (
                                              <span
                                                className={cn(
                                                  'text-sm',
                                                  isDiscontinued
                                                    ? 'text-muted-foreground'
                                                    : 'text-warning-foreground',
                                                )}
                                              >
                                                Shows as:{' '}
                                                {med.detectedAs
                                                  .map((s: string) => formatSubstance(s, true))
                                                  .join(', ')}
                                              </span>
                                            )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {isNew && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              field.removeValue(i)
                                            }}
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive size-8"
                                            title="Remove medication"
                                          >
                                            <Trash2 className="size-4" />
                                          </Button>
                                        )}
                                        <ChevronDown className="size-4 transition-transform duration-200 in-data-[state=open]:rotate-180" />
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>

                                  {/* Content - collapsible */}
                                  <CollapsibleContent>
                                    <div className="space-y-4 border-t px-4 pt-4 pb-4">
                                      {/* Medication Name */}
                                      <form.Field name={`medications[${i}].medicationName`}>
                                        {(subField) => (
                                          <Field>
                                            <FieldContent>
                                              <FieldLabel>Medication Name *</FieldLabel>
                                              <Input
                                                value={subField.state.value ?? ''}
                                                onChange={(e) =>
                                                  subField.handleChange(e.target.value)
                                                }
                                                placeholder="e.g., Ibuprofen"
                                                disabled={isLocked}
                                                className={cn(
                                                  isLocked && 'cursor-not-allowed opacity-50',
                                                )}
                                              />
                                              <FieldError errors={subField.state.meta.errors} />
                                            </FieldContent>
                                          </Field>
                                        )}
                                      </form.Field>

                                      {/* Date row */}
                                      <div className="grid grid-cols-2 gap-4">
                                        {/* Start Date */}
                                        <form.Field name={`medications[${i}].startDate`}>
                                          {(subField) => (
                                            <Field>
                                              <FieldContent>
                                                <FieldLabel>Start Date *</FieldLabel>
                                                <Input
                                                  type="date"
                                                  value={subField.state.value ?? ''}
                                                  onChange={(e) =>
                                                    subField.handleChange(e.target.value)
                                                  }
                                                  disabled={isLocked}
                                                  className={cn(
                                                    isLocked && 'cursor-not-allowed opacity-50',
                                                  )}
                                                />
                                                <FieldError errors={subField.state.meta.errors} />
                                              </FieldContent>
                                            </Field>
                                          )}
                                        </form.Field>

                                        {/* End Date */}
                                        <form.Field name={`medications[${i}].endDate`}>
                                          {(subField) => (
                                            <Field>
                                              <FieldContent>
                                                <FieldLabel>End Date</FieldLabel>
                                                <Input
                                                  type="date"
                                                  value={subField.state.value || ''}
                                                  onChange={(e) =>
                                                    subField.handleChange(e.target.value || '')
                                                  }
                                                  disabled={isLocked}
                                                  className={cn(
                                                    isLocked && 'cursor-not-allowed opacity-50',
                                                  )}
                                                />
                                              </FieldContent>
                                            </Field>
                                          )}
                                        </form.Field>
                                      </div>

                                      {/* Status */}
                                      <form.Field name={`medications[${i}].status`}>
                                        {(subField) => (
                                          <Field>
                                            <FieldContent>
                                              <FieldLabel>Status *</FieldLabel>
                                              <Select
                                                value={subField.state.value ?? 'active'}
                                                onValueChange={(value) =>
                                                  subField.handleChange(
                                                    value as 'active' | 'discontinued',
                                                  )
                                                }
                                                disabled={isLocked}
                                              >
                                                <SelectTrigger
                                                  className={cn(
                                                    isLocked && 'cursor-not-allowed opacity-50',
                                                  )}
                                                >
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="active">Active</SelectItem>
                                                  <SelectItem value="discontinued">
                                                    Discontinued
                                                  </SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </FieldContent>
                                          </Field>
                                        )}
                                      </form.Field>

                                      {/* Detected As - multi-select */}
                                      <form.Field name={`medications[${i}].detectedAs`}>
                                        {(subField) => {
                                          const selectedValues = subField.state.value || []
                                          const toggleSubstance = (value: string) => {
                                            const current = selectedValues as string[]
                                            if (current.includes(value)) {
                                              subField.handleChange(
                                                current.filter((v) => v !== value),
                                              )
                                            } else {
                                              subField.handleChange([...current, value])
                                            }
                                          }
                                          return (
                                            <Field>
                                              <FieldContent>
                                                <FieldLabel>Detected As (on drug test)</FieldLabel>
                                                <div className="border-border grid grid-cols-2 gap-2 rounded-md border p-3">
                                                  {DRUG_TEST_SUBSTANCES.map((substance) => (
                                                    <label
                                                      key={substance.value}
                                                      className={cn(
                                                        'hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm transition-colors',
                                                        isLocked && 'cursor-not-allowed opacity-50',
                                                      )}
                                                    >
                                                      <Checkbox
                                                        checked={(
                                                          selectedValues as string[]
                                                        ).includes(substance.value)}
                                                        onCheckedChange={() =>
                                                          toggleSubstance(substance.value)
                                                        }
                                                        disabled={isLocked}
                                                      />
                                                      <span>{substance.label}</span>
                                                    </label>
                                                  ))}
                                                </div>
                                              </FieldContent>
                                            </Field>
                                          )
                                        }}
                                      </form.Field>

                                      {/* Require Confirmation */}
                                      <form.Field name={`medications[${i}].requireConfirmation`}>
                                        {(subField) => (
                                          <Field orientation="horizontal">
                                            <Checkbox
                                              id={`requireConfirmation-${i}`}
                                              checked={subField.state.value || false}
                                              onCheckedChange={(checked) =>
                                                subField.handleChange(checked as boolean)
                                              }
                                              disabled={isLocked}
                                              className={cn(
                                                isLocked && 'cursor-not-allowed opacity-50',
                                              )}
                                            />
                                            <FieldLabel
                                              htmlFor={`requireConfirmation-${i}`}
                                              className={cn(isLocked && 'text-muted-foreground')}
                                            >
                                              Require confirmation (MAT medication)
                                            </FieldLabel>
                                          </Field>
                                        )}
                                      </form.Field>

                                      {/* Notes */}
                                      <form.Field name={`medications[${i}].notes`}>
                                        {(subField) => (
                                          <Field>
                                            <FieldContent>
                                              <FieldLabel>Notes</FieldLabel>
                                              <Textarea
                                                value={subField.state.value || ''}
                                                onChange={(e) =>
                                                  subField.handleChange(e.target.value)
                                                }
                                                placeholder="Additional notes about this medication"
                                                className={cn(
                                                  'min-h-20',
                                                  isLocked && 'cursor-not-allowed opacity-50',
                                                )}
                                                disabled={isLocked}
                                              />
                                            </FieldContent>
                                          </Field>
                                        )}
                                      </form.Field>
                                    </div>
                                  </CollapsibleContent>
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
