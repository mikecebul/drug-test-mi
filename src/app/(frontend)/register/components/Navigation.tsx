'use client'

import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
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
    <div className="flex justify-between mt-8">
      <Button
        type="button"
        onClick={onBack}
        variant="outline"
        disabled={isFirstStep || isSubmitting}
        className={isFirstStep ? 'cursor-not-allowed opacity-50' : ''}
      >
        <ChevronLeft className="w-5 h-5 mr-2" />
        Previous
      </Button>

      {!isLastStep ? (
        <Button type="button" onClick={onNext} disabled={isSubmitting || isNextDisabled}>
          Next
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          className={`bg-secondary hover:bg-secondary/90 text-secondary-foreground ${
            isSubmitting ? 'cursor-not-allowed opacity-50' : ''
          }`}
          disabled={isSubmitting || isNextDisabled}
        >
          {isSubmitting ? (
            'Processing...'
          ) : (
            <>
              Complete Registration
              <Check className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      )}
    </div>
  )
}
