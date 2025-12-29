import { useState, useCallback } from 'react'
import type { AnyFormApi } from '@tanstack/react-form'
import type { ZodObject } from 'zod'
import { toast } from 'sonner'

/**
 * Options for handling cancel/back actions
 */
type HandleCancelOrBackOpts = {
  onBack?: VoidFunction
  onCancel?: VoidFunction
}

/**
 * State of the current step
 */
type StepState = {
  value: number
  count: number
  goToNextStep: () => void
  goToPrevStep: () => void
  isCompleted: boolean
}

/**
 * Hook for managing multi-step form navigation and validation
 *
 * @param schemas - Array of Zod schemas for each step
 * @returns Object with stepper state and methods
 */
export function useFormStepper(schemas: ZodObject<any>[]) {
  const stepCount = schemas.length
  const [currentStep, setCurrentStep] = useState(1) // Start from 1

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, stepCount))
  }, [stepCount])

  const goToPrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }, [])

  const step: StepState = {
    value: currentStep,
    count: stepCount,
    goToNextStep,
    goToPrevStep,
    isCompleted: currentStep === stepCount,
  }

  const currentValidator = schemas[currentStep - 1] // Convert to 0-based for array access
  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === stepCount

  const triggerFormGroup = async (form: AnyFormApi) => {
    // Validate all fields to trigger field-level error display
    await form.validateAllFields('change')

    // Get all form values
    const allValues = form.baseStore.state.values

    // Extract only the values for the current step fields
    const currentStepFields = Object.keys(currentValidator.shape)
    const stepValues: Record<string, any> = {}

    for (const fieldName of currentStepFields) {
      if (fieldName in allValues) {
        stepValues[fieldName] = allValues[fieldName]
      }
    }

    const result = currentValidator.safeParse(stepValues)
    if (!result.success) {
      // Show validation errors but don't submit the form
      // Display the first validation error as a toast
      console.log('Validation failed:', { stepValues, errors: result.error })
      const firstError = result.error?.issues?.[0]
      if (firstError) {
        toast.error(firstError.message || 'Please complete all required fields')
      } else {
        toast.error('Please complete all required fields')
      }
      return result
    }

    return result
  }

  const handleNextStepOrSubmit = async (form: AnyFormApi) => {
    const result = await triggerFormGroup(form)
    if (!result.success) {
      return
    }

    if (currentStep < stepCount) {
      goToNextStep()
      return
    }

    if (currentStep === stepCount) {
      form.handleSubmit()
    }
  }

  const handleCancelOrBack = (opts?: HandleCancelOrBackOpts) => {
    if (isFirstStep) {
      opts?.onCancel?.()
      return
    }

    if (currentStep > 1) {
      opts?.onBack?.()
      goToPrevStep()
    }
  }

  return {
    step, // Current step state
    currentStep, // Current step number (1-based)
    setCurrentStep, // Set current step directly (1-based)
    isFirstStep, // Whether current step is the first step
    isLastStep, // Whether current step is the last step
    currentValidator, // Zod schema for current step
    triggerFormGroup, // Validate current step fields
    handleNextStepOrSubmit, // Handle next/submit action
    handleCancelOrBack, // Handle back/cancel action
  }
}
