'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useFormStepper } from '@/app/(frontend)/register/hooks/useFormStepper'
import { VerifyClientFieldGroup } from '../field-groups/VerifyClientFieldGroup'
import { CollectionDetailsFieldGroup } from '../field-groups/CollectionDetailsFieldGroup'
import { ReviewCollectionEmailsFieldGroup } from '../field-groups/ReviewCollectionEmailsFieldGroup'
import { z } from 'zod'
import { verifyClientFieldSchema } from '../field-groups/VerifyClientFieldGroup'
import { collectionDetailsFieldSchema } from '../field-groups/CollectionDetailsFieldGroup'
import { reviewCollectionEmailsFieldSchema } from '../field-groups/ReviewCollectionEmailsFieldGroup'
import { createCollectionWithEmailReview } from '../actions'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'

// Step schemas
const verifyClientSchema = z.object({
  clientData: verifyClientFieldSchema,
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

const stepSchemas = [verifyClientSchema, collectionDetailsSchema, confirmSchema, reviewEmailsSchema]

// Complete form schema
const completeCollectLabSchema = z.object({
  clientData: verifyClientFieldSchema,
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

  const handleComplete = (testId: string) => {
    router.push(`/admin/collections/drug-tests/${testId}`)
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
        matchType: 'fuzzy' as const,
        score: 0,
      },
      collectionDetails: {
        testType: '11-panel-lab' as const,
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: new Date().toTimeString().slice(0, 5),
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
        // Combine date and time
        const dateTimeStr = `${value.collectionDetails.collectionDate} ${value.collectionDetails.collectionTime}`
        const collectionDate = new Date(dateTimeStr).toISOString()

        // Create collection with email review
        const result = await createCollectionWithEmailReview(
          {
            clientId: value.clientData.id,
            testType: value.collectionDetails.testType,
            collectionDate,
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

  const {
    currentStep,
    isLastStep,
    handleNextStepOrSubmit,
    handleCancelOrBack,
    setCurrentStep,
  } = useFormStepper(stepSchemas)

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
    { id: 'collection-details', label: 'Details' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'review-emails', label: 'Emails' },
  ]

  const stepMapping: Record<number, string> = {
    1: 'verify-client',
    2: 'collection-details',
    3: 'confirm',
    4: 'review-emails',
  }

  const currentStepId = stepMapping[currentStep]

  // Get form values for confirmation
  const formValues = useStore(form.store, (state) => state.values)

  return (
    <ShadcnWrapper className="mx-auto my-32 flex max-w-sm scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Collect Lab Specimen</h1>
        <p className="text-muted-foreground">
          Record specimen collection for laboratory testing
        </p>
      </div>

      <div className="mb-8">
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
            />
          )}

          {currentStep === 2 && (
            <CollectionDetailsFieldGroup
              form={form}
              fields="collectionDetails"
              title="Collection Details"
              description=""
            />
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Confirm Collection</h2>
                <p className="text-muted-foreground mt-2">
                  Review the collection details before creating the record
                </p>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Client</h3>
                      <p className="text-lg">
                        {formValues.clientData.firstName} {formValues.clientData.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{formValues.clientData.email}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Test Type</h3>
                      <p className="text-lg">
                        {formValues.collectionDetails.testType === '11-panel-lab'
                          ? '11-Panel Lab Test'
                          : formValues.collectionDetails.testType === '17-panel-sos-lab'
                          ? '17-Panel SOS Lab Test'
                          : 'EtG Lab Test'}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Collection Date & Time
                      </h3>
                      <p className="text-lg">
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
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 4 && (
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
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {!isLastStep ? (
            <Button type="button" onClick={handleNext}>
              Next
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              className={`bg-secondary text-secondary-foreground hover:bg-secondary/90 ${
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
