'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { steps } from '../validators'
import { collectLabFormOpts } from '../shared-form'

export const CollectLabNavigation = withForm({
  ...collectLabFormOpts,

  render: function Render({ form }) {
    const currentStep = useStore(form.store, (state) => state.values.step)
    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const canSubmit = useStore(form.store, (state) => state.canSubmit)

    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1

    const handleBack = () => {
      if (isFirstStep) {
        console.log('Todo: do something')
      } else {
        const prevStep = steps[currentIndex - 1]
        form.setFieldValue('step', prevStep as any)
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
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button disabled={isSubmitting || !canSubmit} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isLastStep ? 'Submit' : 'Next'}
              {isLastStep ? (
                <Check className="ml-2 h-5 w-5" />
              ) : (
                <ChevronRight className="ml-2 h-5 w-5" />
              )}
            </>
          )}
        </Button>
      </div>
    )
  },
})
