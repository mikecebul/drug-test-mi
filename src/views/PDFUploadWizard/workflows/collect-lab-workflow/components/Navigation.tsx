'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { steps } from '../validators'
import { collectLabFormOpts } from '../shared-form'

export const CollectLabNavigation = withForm({
  ...collectLabFormOpts,
  props: {
    onBack: (): void => {},
  },

  render: function Render({ form, onBack }) {
    // Read step from URL (single source of truth)
    const [currentStepRaw, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('client')
    )
    const currentStep = currentStepRaw as typeof steps[number]

    const [isSubmitting, errors] = useStore(form.store, (state) => [
      state.isSubmitting,
      state.errors,
    ])

    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1

    // Only consider errors from the current step for enabling/disabling navigation
    const currentStepHasErrors = errors.some((errorObj) => {
      if (!errorObj) return false
      const fieldNames = Object.keys(errorObj)
      return fieldNames.some((fieldName) => {
        switch (currentStep) {
          case 'client':
            return fieldName.startsWith('client.')
          case 'medications':
            return fieldName.startsWith('medications')
          case 'collection':
            return fieldName.startsWith('collection.')
          case 'confirm':
            return false
          case 'reviewEmails':
            return fieldName.startsWith('emails.')
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
        setCurrentStep(prevStep, { history: 'push' }) // Update URL, triggers validation reset in Workflow.tsx
      }
    }

    return (
      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button type="button" onClick={handleBack} variant="outline" disabled={isSubmitting} size="lg">
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button disabled={isSubmitting || currentStepHasErrors} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isLastStep ? 'Submit' : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
