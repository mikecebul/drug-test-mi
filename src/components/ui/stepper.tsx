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
    <div className="stepper-container mb-8">
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId
          const isCompleted = index < currentIndex
          const isUpcoming = index > currentIndex
          const isClickable = isCompleted && onStepClick

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center shrink-0">
                <div
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={`
                    flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-full border-2 font-semibold text-xs md:text-sm
                    ${isActive ? 'border-blue-600 bg-blue-600 text-white' : ''}
                    ${isCompleted ? 'border-green-600 bg-green-600 text-white cursor-pointer hover:bg-green-700' : ''}
                    ${isUpcoming ? 'border-gray-300 bg-white text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div
                  className={`
                    mt-0.5 md:mt-1 text-[10px] md:text-xs font-medium text-center max-w-[60px] md:max-w-none leading-tight
                    ${isActive ? 'text-blue-600' : ''}
                    ${isCompleted ? 'text-green-600' : ''}
                    ${isUpcoming ? 'text-gray-400' : ''}
                  `}
                >
                  {step.label}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`
                    h-0.5 min-w-2 flex-1 max-w-[60px]
                    ${index < currentIndex ? 'bg-green-600' : 'bg-gray-300'}
                  `}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
