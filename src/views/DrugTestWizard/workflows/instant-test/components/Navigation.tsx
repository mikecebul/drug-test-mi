'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { useComputeTestResultPreviewQuery, useExtractPdfQuery } from '../../../queries'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { instantTestFormOpts } from '../shared-form'
import { steps } from '../validators'
import { useWizardSession } from '@/views/DrugTestWizard/components/main-wizard/WizardSessionGuard'
import { getReportClientMatch, getReportClientMismatchKey } from '../utils/reportClientMatch'

type WorkflowGroup = {
  state: {
    meta: {
      isSubmitting: boolean
      canSubmit: boolean
      isValid: boolean
      submissionAttempts: number
    }
  }
  handleSubmit: () => void | Promise<void>
}

export const InstantTestNavigation = withForm({
  ...instantTestFormOpts,
  props: {
    onBack: (): void => {},
    group: undefined as unknown as WorkflowGroup,
  },

  render: function Render({ form, onBack, group }) {
    const { isCheckingSession, requireActiveSession } = useWizardSession()
    const [currentStep, setCurrentStep] = useQueryState('step', parseAsStringLiteral(steps).withDefault('upload'))

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const values = useStore(form.store, (state) => state.values)
    const [bookingId] = useQueryState('bookingId', parseAsString)
    const { data: extractedData } = useExtractPdfQuery(
      currentStep === 'extract' ? values.upload.file : null,
      'instant-test',
    )
    const identity =
      currentStep === 'extract' && values.client.id
        ? getReportClientMatch(extractedData?.donorName, values.client, extractedData?.dob)
        : null
    const identityNeedsConfirmation =
      identity?.requiresConfirmation &&
      (!values.extract.clientMismatchConfirmed ||
        values.extract.clientMismatchConfirmationKey !== getReportClientMismatchKey(identity))
    const needsPreview = currentStep === 'verifyData' || currentStep === 'reviewEmails'
    const {
      data: preview,
      isFetching,
      isError,
    } = useComputeTestResultPreviewQuery(
      needsPreview ? values.client.id : null,
      values.verifyData.detectedSubstances as SubstanceValue[],
      values.verifyData.testType,
      values.verifyData.breathalyzerTaken,
      values.verifyData.breathalyzerResult,
      values.medications,
    )
    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1
    const nextDisabled =
      isSubmitting ||
      group.state.meta.isSubmitting ||
      isCheckingSession ||
      identityNeedsConfirmation ||
      (bookingId && currentStep === 'upload' && !values.upload.file) ||
      (needsPreview && (!preview || isFetching || isError))
    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = bookingId && currentStep === 'medications' ? 'extract' : steps[currentIndex - 1]
        setCurrentStep(prevStep, { history: 'push' })
      }
    }
    const handleNext = async () => {
      if (!(await requireActiveSession())) return
      await group.handleSubmit()
    }

    return (
      <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-4 min-[500px]:flex-row min-[500px]:items-center min-[500px]:justify-between">
        <Button
          type="button"
          onClick={handleBack}
          variant="outline"
          disabled={isSubmitting}
          size="lg"
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep
            ? bookingId
              ? 'Back to payment'
              : 'Cancel'
            : currentStep === 'extract'
              ? 'Back to upload'
              : 'Back'}
        </Button>

        <Button
          type="button"
          disabled={nextDisabled}
          size="lg"
          onClick={() => void handleNext()}
          data-testid="wizard-next-button"
        >
          {isSubmitting || isCheckingSession ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isLastStep
                ? 'Create Drug Test'
                : currentStep === 'upload'
                  ? 'Review uploaded report'
                  : currentStep === 'extract'
                    ? 'Continue to medications'
                    : currentStep === 'medications'
                      ? 'Continue to test details'
                      : currentStep === 'verifyData'
                        ? 'Review notifications'
                        : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
