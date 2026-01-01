'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { withForm } from '@/blocks/Form/hooks/form'

import { useStore } from '@tanstack/react-form'
import { testWorkflowFormOpts } from '../workflows/collect-lab/shared-form'

export const FormNavigationComponent = withForm({
  ...testWorkflowFormOpts,
  props: {
    steps: ['client'],
  },

  render: function Render({ form, steps }) {
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
        <Button type="button" onClick={handleBack} variant="outline" disabled={isSubmitting} size="lg">
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button
          disabled={isSubmitting || !canSubmit}
          size="lg"
          className={cn('', {
            'bg-secondary text-secondary-foreground hover:bg-secondary/90': isLastStep,
          })}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isLastStep ? 'cancel' : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
