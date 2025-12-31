'use client'

import React, { Suspense } from 'react'
import { parseAsStringLiteral, parseAsString, useQueryStates } from 'nuqs'
import { WizardTypeSelector } from './WizardTypeSelector'
import { WizardTypeSelectorSkeleton } from './WizardTypeSelectorSkeleton'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/instant-test-workflow/Workflow'
import type { WizardType } from './types'
import { WizardHeader } from './components/WizardHeader'
import { CollectLabWorkflow } from './workflows/collect-lab-workflow/Workflow'
import { steps as collectLabSteps } from './workflows/collect-lab-workflow/validators'
import { RegisterClientWorkflow } from './workflows/register-client-workflow/Workflow'
import { steps as registerClientSteps } from './workflows/register-client-workflow/validators'
import { steps as instantTestSteps } from './workflows/instant-test-workflow/validators'

const workflowTypes = [
  'register-client',
  'collect-lab',
  'enter-lab-screen',
  'enter-lab-confirmation',
  '15-panel-instant',
] as const

export function PDFUploadWizardClient() {
  const [states, setStates] = useQueryStates(
    {
      workflow: parseAsStringLiteral(workflowTypes),
      step: parseAsString, // Use generic string so it accepts all workflow step types
      clientId: parseAsString,
    },
    {
      history: 'push', // Default all updates to push to history
    },
  )

  const { workflow } = states

  const firstStepMap: Record<string, string> = {
    'register-client': registerClientSteps[0],
    'collect-lab': collectLabSteps[0],
    '15-panel-instant': instantTestSteps[0],
  }

  // Reset workflow selection and clear step params
  const handleBack = async () => {
    setStates({
      workflow: null,
      step: null,
      clientId: null,
    })
  }

  // Handle workflow type selection
  const handleWorkflowSelect = (wizardType: WizardType) => {
    setStates({
      workflow: wizardType,
      step: firstStepMap[wizardType] ?? null,
      clientId: null,
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
    return <RegisterClientWorkflow onBack={handleBack} />
  }

  if (workflow === 'collect-lab') {
    return <CollectLabWorkflow onBack={handleBack} />
  }

  if (workflow === 'enter-lab-screen') {
    return <EnterLabScreenWorkflow onBack={handleBack} />
  }

  if (workflow === 'enter-lab-confirmation') {
    return <EnterLabConfirmationWorkflow onBack={handleBack} />
  }

  if (workflow === '15-panel-instant') {
    return <InstantTestWorkflow onBack={handleBack} />
  }

  return null
}
