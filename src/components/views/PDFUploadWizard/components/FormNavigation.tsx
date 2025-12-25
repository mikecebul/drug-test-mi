'use client'

import { useStore, type AnyFormApi } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/utilities/cn'

export interface FormNavigationProps {
  form: AnyFormApi
  sections: string[]
  lastStepLabel?: string
}

export function FormNavigation({
  form,
  sections,
  lastStepLabel = 'Create Record',
}: FormNavigationProps) {
  // Subscribe to current section and submission state
  const currentSection = useStore(form.store, (state) => state.values.section)
  const [isSubmitting, canSubmit] = useStore(form.store, (state) => [
    state.isSubmitting,
    state.canSubmit,
  ])

  const currentIndex = sections.indexOf(currentSection)
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === sections.length - 1

  const router = useRouter()

  const handleBack = () => {
    if (isFirstStep) {
      console.log('Todo: do something')
    } else {
      const prevSection = sections[currentIndex - 1]
      form.setFieldValue('section', prevSection)
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
            {isLastStep ? lastStepLabel : 'Next'}
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
}
