'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface RegisterNavigationProps {
  isFirstStep: boolean
  isLastStep: boolean
  isSubmitting: boolean
  isNextDisabled?: boolean
  onBack: () => void
  onNext: () => void
}

export function RegisterNavigation({
  isFirstStep,
  isLastStep,
  isSubmitting,
  isNextDisabled = false,
  onBack,
  onNext,
}: RegisterNavigationProps) {
  return (
    <div className="mt-8 flex justify-between gap-3">
      <Button
        type="button"
        onClick={onBack}
        variant="outline"
        disabled={isFirstStep || isSubmitting}
      >
        <ChevronLeft data-icon="inline-start" />
        Previous
      </Button>

      {!isLastStep ? (
        <Button type="button" onClick={onNext} disabled={isSubmitting || isNextDisabled}>
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          variant="secondary"
          size="sm"
          disabled={isSubmitting || isNextDisabled}
        >
          {isSubmitting ? 'Processing...' : 'Complete Registration'}
        </Button>
      )}
    </div>
  )
}
