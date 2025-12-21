'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronLeft, Check, User, CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useFormStepper } from '@/app/(frontend)/register/hooks/useFormStepper'
import { VerifyClientFieldGroup } from './VerifyClientFieldGroup'
import { VerifyMedicationsFieldGroup } from './VerifyMedicationsFieldGroup'
import { CollectionDetailsFieldGroup } from './CollectionDetailsFieldGroup'
import { ReviewCollectionEmailsFieldGroup } from './ReviewCollectionEmailsFieldGroup'
import { z } from 'zod'
import { verifyClientFieldSchema } from '../../field-groups/BaseVerifyClientFieldGroup'
import { verifyMedicationsFieldSchema } from '../../field-groups/BaseVerifyMedicationsFieldGroup'
import { collectionDetailsFieldSchema } from '../../field-groups/CollectionDetailsFieldGroup'
import { reviewCollectionEmailsFieldSchema } from '../../field-groups/ReviewCollectionEmailsFieldGroup'
import { createCollectionWithEmailReview, updateClientMedications } from '../../actions'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { wizardContainerStyles, wizardWrapperStyles } from '../../styles'
import { cn } from '@/utilities/cn'
import { WizardHeader } from '../../components/WizardHeader'

// Step schemas
const verifyClientSchema = z.object({
  clientData: verifyClientFieldSchema,
})

const verifyMedicationsSchema = z.object({
  medicationsData: verifyMedicationsFieldSchema,
})

const collectionDetailsSchema = z.object({
  collectionDetails: collectionDetailsFieldSchema,
})

const confirmSchema = z.object({
  confirmData: z.object({
    confirmed: z.boolean(),
  }),
})

const reviewEmailsSchema = z.object({
  reviewEmailsData: reviewCollectionEmailsFieldSchema,
})

const stepSchemas = [
  verifyClientSchema,
  verifyMedicationsSchema,
  collectionDetailsSchema,
  confirmSchema,
  reviewEmailsSchema,
]

// Complete form schema
const completeCollectLabSchema = z.object({
  clientData: verifyClientFieldSchema,
  medicationsData: verifyMedicationsFieldSchema,
  collectionDetails: collectionDetailsFieldSchema,
  confirmData: z.object({
    confirmed: z.boolean(),
  }),
  reviewEmailsData: reviewCollectionEmailsFieldSchema,
})

type CollectLabFormType = z.infer<typeof completeCollectLabSchema>

interface CollectLabWorkflowProps {
  onBack: () => void
}

export function CollectLabWorkflow({ onBack }: CollectLabWorkflowProps) {
  const router = useRouter()
  const [completedTestId, setCompletedTestId] = useState<string | null>(null)

  const handleComplete = (testId: string) => {
    setCompletedTestId(testId)
  }

  const formOpts = {
    defaultValues: {
      clientData: {
        id: '',
        firstName: '',
        lastName: '',
        middleInitial: null,
        email: '',
        dob: null,
        headshot: null,
        matchType: 'fuzzy' as const,
        score: 0,
      },
      medicationsData: {
        verified: true,
        medications: [],
      },
      collectionDetails: {
        testType: '11-panel-lab' as const,
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: new Date().toTimeString().slice(0, 5),
        breathalyzerTaken: false,
        breathalyzerResult: null,
      },
      confirmData: {
        confirmed: false,
      },
      reviewEmailsData: {
        clientEmailEnabled: false, // No client emails for collection
        clientRecipients: [],
        referralEmailEnabled: true, // Only referral emails for collection notification
        referralRecipients: [],
        previewsLoaded: false,
      },
    },
    onSubmit: async ({ value }: { value: CollectLabFormType }) => {
      try {
        // Update client medications if provided
        if (value.medicationsData.medications && value.medicationsData.medications.length >= 0) {
          const medicationUpdateResult = await updateClientMedications(
            value.clientData.id,
            value.medicationsData.medications,
          )
          if (!medicationUpdateResult.success) {
            toast.error('Failed to update medications')
            throw new Error(medicationUpdateResult.error || 'Failed to update medications')
          }
        }

        // Combine date and time
        const dateTimeStr = `${value.collectionDetails.collectionDate} ${value.collectionDetails.collectionTime}`
        const collectionDate = new Date(dateTimeStr).toISOString()

        // Create collection with email review
        const result = await createCollectionWithEmailReview(
          {
            clientId: value.clientData.id,
            testType: value.collectionDetails.testType,
            collectionDate,
            breathalyzerTaken: value.collectionDetails.breathalyzerTaken ?? false,
            breathalyzerResult: value.collectionDetails.breathalyzerResult ?? null,
          },
          {
            referralEmailEnabled: value.reviewEmailsData.referralEmailEnabled,
            referralRecipients: value.reviewEmailsData.referralRecipients,
          },
        )

        if (result.success && result.testId) {
          handleComplete(result.testId)
        } else {
          throw new Error(result.error || 'Failed to create collection record')
        }
      } catch (error: any) {
        console.error('Error creating collection:', error)
        throw error
      }
    },
  }

  const form = useAppForm(formOpts)

  const { currentStep, isLastStep, handleNextStepOrSubmit, handleCancelOrBack, setCurrentStep } =
    useFormStepper(stepSchemas)

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handleNext = async () => {
    await handleNextStepOrSubmit(form)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrevious = () => {
    if (currentStep === 1) {
      onBack()
    } else {
      handleCancelOrBack({
        onBack: () => {},
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleStepClick = (stepId: string) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId)
    if (stepIndex !== -1 && stepIndex < currentStep - 1) {
      setCurrentStep(stepIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const steps: Step[] = [
    { id: 'verify-client', label: 'Client' },
    { id: 'verify-medications', label: 'Medications' },
    { id: 'collection-details', label: 'Details' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Emails' },
  ]

  const stepMapping: Record<number, string> = {
    1: 'verify-client',
    2: 'verify-medications',
    3: 'collection-details',
    4: 'confirm',
    5: 'review-emails',
  }

  const currentStepId = stepMapping[currentStep]

  // Get form values for confirmation
  const formValues = useStore(form.store, (state) => state.values)

  // Show completion screen if collection was created successfully
  if (completedTestId) {
    return (
      <ShadcnWrapper className={wizardWrapperStyles.completion}>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Collection Recorded Successfully!
          </h1>
          <p className="text-muted-foreground">
            The specimen collection has been recorded and notification email has been sent.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onBack} size="lg">
            Start New Workflow
          </Button>
          <Button
            onClick={() => router.push(`/admin/collections/drug-tests/${completedTestId}`)}
            variant="outline"
            size="lg"
          >
            View Collection
          </Button>
        </div>
      </ShadcnWrapper>
    )
  }

  return (
    <ShadcnWrapper className={wizardWrapperStyles.workflow}>
      <div className={wizardWrapperStyles.header}>
        <WizardHeader
          title="Collect Lab Specimen"
          description="Record specimen collection for laboratory testing"
        />
      </div>

      <div className={wizardWrapperStyles.stepper}>
        <Stepper steps={steps} currentStepId={currentStepId} onStepClick={handleStepClick} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className="flex flex-1 flex-col"
      >
        <div className="wizard-content mb-8 flex-1">
          {currentStep === 1 && (
            <VerifyClientFieldGroup
              form={form}
              fields="clientData"
              title="Select Client"
              workflowType={'lab' as const}
            />
          )}

          {currentStep === 2 && (
            <VerifyMedicationsFieldGroup
              form={form}
              fields="medicationsData"
              title="Verify Medications"
              description="Review and update the client's medications for accurate drug test interpretation"
            />
          )}

          {currentStep === 3 && (
            <CollectionDetailsFieldGroup
              form={form}
              fields="collectionDetails"
              title="Collection Details"
              description=""
            />
          )}

          {currentStep === 4 && (
            <div className={wizardContainerStyles.content}>
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Confirm Collection</h2>
                <p className="text-muted-foreground mt-3 text-lg">
                  Review the collection details before creating the record
                </p>
              </div>

              <Card className={wizardContainerStyles.card}>
                <CardContent
                  className={cn(wizardContainerStyles.fields, 'pt-6 text-base md:text-lg')}
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4" />
                        Client
                      </h3>
                      <div className="mt-2 flex items-start gap-3 pl-6">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={formValues.clientData.headshot ?? undefined}
                            alt={`${formValues.clientData.firstName} ${formValues.clientData.lastName}`}
                          />
                          <AvatarFallback className="text-sm">
                            {formValues.clientData.firstName?.charAt(0)}
                            {formValues.clientData.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-0.5">
                          <p className="text-lg font-semibold">
                            {formValues.clientData.firstName} {formValues.clientData.lastName}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {formValues.clientData.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-muted-foreground text-sm font-medium">Test Type</h3>
                      <p className="mt-1 pl-6 text-lg">
                        {formValues.collectionDetails.testType === '11-panel-lab'
                          ? '11-Panel Lab Test'
                          : formValues.collectionDetails.testType === '17-panel-sos-lab'
                            ? '17-Panel SOS Lab Test'
                            : 'EtG Lab Test'}
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="text-muted-foreground text-sm font-medium">
                        Collection Date & Time
                      </h3>
                      <p className="mt-1 pl-6 text-lg">
                        {formValues.collectionDetails.collectionDate &&
                          formValues.collectionDetails.collectionTime &&
                          format(
                            new Date(
                              `${formValues.collectionDetails.collectionDate} ${formValues.collectionDetails.collectionTime}`,
                            ),
                            'PPp',
                          )}
                      </p>
                    </div>

                    {formValues.collectionDetails.breathalyzerTaken &&
                      formValues.collectionDetails.breathalyzerResult !== null &&
                      formValues.collectionDetails.breathalyzerResult !== undefined && (
                        <div className="space-y-2 border-t pt-4">
                          <h3 className="text-muted-foreground text-sm font-medium">
                            Breathalyzer Test
                          </h3>
                          <div className="pl-6">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  formValues.collectionDetails.breathalyzerResult! > 0.0
                                    ? 'destructive'
                                    : 'default'
                                }
                                className={
                                  formValues.collectionDetails.breathalyzerResult! > 0.0
                                    ? 'gap-1'
                                    : 'gap-1 bg-green-600'
                                }
                              >
                                {formValues.collectionDetails.breathalyzerResult! > 0.0 ? (
                                  <>
                                    <XCircle className="h-3 w-3" />
                                    POSITIVE (FAIL)
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    NEGATIVE (PASS)
                                  </>
                                )}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm">
                              <span className="text-muted-foreground">BAC Level:</span>{' '}
                              <span className="font-mono font-semibold">
                                {formValues.collectionDetails.breathalyzerResult!.toFixed(3)}
                              </span>
                            </p>
                            {formValues.collectionDetails.breathalyzerResult! > 0.0 && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Any detectable alcohol level constitutes a positive result.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 5 && (
            <ReviewCollectionEmailsFieldGroup
              form={form}
              fields="reviewEmailsData"
              title="Review Collection Notification"
              description=""
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            type="button"
            onClick={handlePrevious}
            variant="outline"
            disabled={isSubmitting}
            size="lg"
            className="text-lg"
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {!isLastStep ? (
            <Button type="button" onClick={handleNext} size="lg" className="text-lg">
              Next
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              size="lg"
              className={`bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg ${
                isSubmitting ? 'cursor-not-allowed opacity-50' : ''
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Creating...'
              ) : (
                <>
                  Create Collection Record
                  <Check className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </ShadcnWrapper>
  )
}
