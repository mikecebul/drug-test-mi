'use client'

import { WorkflowProgress } from './WorkflowProgress'

const phases = ['Client', 'Payment', 'Prepare', 'Details', 'Review'] as const
export type CollectionPhase = (typeof phases)[number]
const steps = phases.map((phase) => ({ key: phase, label: phase }))

/** Phases group the conditional screens; they are not a fixed screen count. */
export function CollectionProgress({ phase, completed = false }: { phase: CollectionPhase; completed?: boolean }) {
  return (
    <WorkflowProgress
      steps={steps}
      activeStep={phase}
      completed={completed}
      label="Collection progress"
      className="mb-8"
    />
  )
}
