'use client'

import React from 'react'

export interface Step {
  id: string
  label: string
}

interface StepperProps {
  steps: Step[]
  currentStepId: string
  onStepClick?: (stepId: string) => void
}

export function Stepper({ steps, currentStepId, onStepClick }: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId)

  return (
    <div className="stepper-container mb-12">
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId
          const isCompleted = index < currentIndex
          const isUpcoming = index > currentIndex
          const isClickable = isCompleted && onStepClick

          return (
            <React.Fragment key={step.id}>
              <div className="flex shrink-0 flex-col items-center">
                <div
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold md:h-9 md:w-9 md:text-sm ${isActive ? 'border-blue-600 bg-blue-600 text-white' : ''} ${isCompleted ? 'cursor-pointer border-green-600 bg-green-600 text-white hover:bg-green-700' : ''} ${isUpcoming ? 'border-gray-300 bg-white text-gray-400' : ''} `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div
                  className={`mt-0.5 max-w-[60px] text-center text-[10px] leading-tight font-medium md:mt-1 md:max-w-none md:text-xs ${isActive ? 'text-blue-600' : ''} ${isCompleted ? 'text-green-600' : ''} ${isUpcoming ? 'text-gray-400' : ''} `}
                >
                  {step.label}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 max-w-[60px] min-w-2 flex-1 ${index < currentIndex ? 'bg-green-600' : 'bg-gray-300'} `}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
