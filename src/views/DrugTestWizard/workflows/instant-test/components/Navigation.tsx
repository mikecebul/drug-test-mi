'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { instantTestFormOpts } from '../shared-form'
import { steps } from '../validators'

export const InstantTestNavigation = withForm({
  ...instantTestFormOpts,
  props: {
    onBack: (): void => {},
  },

  render: function Render({ form, onBack }) {
    const [currentStepRaw, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
    )
    const currentStep = currentStepRaw as (typeof steps)[number]

    const [isSubmitting, errors] = useStore(form.store, (state) => [state.isSubmitting, state.errors])

    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1
    const isStepField = (fieldName: string, stepName: string) => fieldName === stepName || fieldName.startsWith(`${stepName}.`)

    // Check for current step errors
    const currentStepHasErrors = errors.some((errorObj) => {
      if (!errorObj) return false
      const fieldNames = Object.keys(errorObj)
      return fieldNames.some((fieldName) => {
        switch (currentStep) {
          case 'upload':
            return isStepField(fieldName, 'upload')
          case 'extract':
            return isStepField(fieldName, 'extract')
          case 'client':
            return isStepField(fieldName, 'client')
          case 'medications':
            return isStepField(fieldName, 'medications')
          case 'verifyData':
            return isStepField(fieldName, 'verifyData')
          case 'confirm':
            return false
          case 'reviewEmails':
            return isStepField(fieldName, 'emails')
          default:
            return false
        }
      })
    })

    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = steps[currentIndex - 1]
        setCurrentStep(prevStep, { history: 'push' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    return (
      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button
          type="button"
          onClick={handleBack}
          variant="outline"
          disabled={isSubmitting}
          size="lg"
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button
          type="button"
          disabled={isSubmitting || currentStepHasErrors}
          size="lg"
          onClick={() => form.handleSubmit()}
          data-testid="wizard-next-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isLastStep ? 'Create Drug Test' : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
