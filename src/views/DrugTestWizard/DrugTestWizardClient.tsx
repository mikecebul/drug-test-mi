'use client'

import React, { Suspense } from 'react'
import { parseAsStringLiteral, parseAsString, useQueryStates } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { WizardTypeSelector } from './components/main-wizard/WizardTypeSelector'
import { WizardTypeSelectorSkeleton } from './components/main-wizard/WizardTypeSelectorSkeleton'
import { LabScreenWorkflow } from './workflows/lab-screen/Workflow'
import { LabConfirmationWorkflow } from './workflows/lab-confirmation/Workflow'
import { InstantTestWorkflow } from './workflows/instant-test/Workflow'
import type { WizardType } from './types'
import { WizardHeader } from './components/main-wizard/WizardHeader'
import { CollectLabWorkflow } from './workflows/collect-lab/Workflow'
import { CompleteWorkflow } from './workflows/complete-workflow/Workflow'
import { steps as collectLabSteps } from './workflows/collect-lab/validators'
import { RegisterClientWorkflow } from './workflows/register-client-workflow/Workflow'
import { steps as registerClientSteps } from './workflows/register-client-workflow/validators'
import { steps as instantTestSteps } from './workflows/instant-test/validators'
import { steps as labScreenSteps } from './workflows/lab-screen/validators'
import { steps as labConfirmationSteps } from './workflows/lab-confirmation/validators'
import { clearWizardQueryCache } from './queries'

const workflowTypes = [
  'complete-workflow',
  'register-client',
  'collect-lab',
  'enter-lab-screen',
  'enter-lab-confirmation',
  'instant-test',
  '15-panel-instant',
  '17-panel-instant',
] as const

type Workflows = typeof workflowTypes

export function DrugTestWizardClient() {
  const queryClient = useQueryClient()
  const [states, setStates] = useQueryStates(
    {
      workflow: parseAsStringLiteral(workflowTypes),
      step: parseAsString, // Use generic string so it accepts all workflow step types
      clientId: parseAsString,
      bookingId: parseAsString,
      reset: parseAsString,
    },
    {
      history: 'push', // Default all updates to push to history
    },
  )

  const { reset, workflow } = states

  const firstStepMap: Record<Workflows[number], string> = {
    'complete-workflow': 'appointments',
    'register-client': registerClientSteps[0],
    'collect-lab': collectLabSteps[0],
    'instant-test': instantTestSteps[0],
    '15-panel-instant': instantTestSteps[0],
    '17-panel-instant': instantTestSteps[0],
    'enter-lab-screen': labScreenSteps[0],
    'enter-lab-confirmation': labConfirmationSteps[0],
  }

  // Reset workflow selection and clear step params
  const handleBack = async () => {
    setStates({
      workflow: null,
      step: null,
      clientId: null,
      bookingId: null,
    })
  }

  // Handle workflow type selection
  const handleWorkflowSelect = (wizardType: WizardType) => {
    clearWizardQueryCache(queryClient)

    setStates({
      workflow: wizardType,
      step: firstStepMap[wizardType] ?? null,
      clientId: null,
      bookingId: null,
    })
  }

  // Show workflow type selector if no workflow is selected
  if (!workflow) {
    return (
      <>
        <WizardHeader title="Drug Test Workflow" description="Select the type of workflow you want to perform" />
        <Suspense fallback={<WizardTypeSelectorSkeleton />}>
          <WizardTypeSelector onSelect={handleWorkflowSelect} />
        </Suspense>
      </>
    )
  }

  // Route to appropriate workflow
  if (workflow === 'register-client') {
    return <RegisterClientWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  if (workflow === 'complete-workflow') {
    return <CompleteWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  if (workflow === 'collect-lab') {
    return <CollectLabWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  if (workflow === 'enter-lab-screen') {
    return <LabScreenWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  if (workflow === 'enter-lab-confirmation') {
    return <LabConfirmationWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  if (workflow === 'instant-test' || workflow === '15-panel-instant' || workflow === '17-panel-instant') {
    return <InstantTestWorkflow key={`${workflow}:${reset ?? ''}`} onBack={handleBack} />
  }

  return null
}
