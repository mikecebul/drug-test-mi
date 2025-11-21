'use client'

import React from 'react'

export interface Step {
  id: string
  label: string
}

interface StepperProps {
  steps: Step[]
  currentStepId: string
}

export function Stepper({ steps, currentStepId }: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId)

  return (
    <div className="stepper-container mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId
          const isCompleted = index < currentIndex
          const isUpcoming = index > currentIndex

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold
                    ${isActive ? 'border-blue-600 bg-blue-600 text-white' : ''}
                    ${isCompleted ? 'border-green-600 bg-green-600 text-white' : ''}
                    ${isUpcoming ? 'border-gray-300 bg-white text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div
                  className={`
                    mt-2 text-sm font-medium
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
                    h-0.5 flex-1 mx-4
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
