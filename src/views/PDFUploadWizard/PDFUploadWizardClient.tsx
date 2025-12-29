'use client'

import React, { Suspense } from 'react'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { WizardTypeSelector } from './WizardTypeSelector'
import { WizardTypeSelectorSkeleton } from './WizardTypeSelectorSkeleton'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/InstantTestWorkflow'
import type { WizardType } from './types'
import { WizardHeader } from './components/WizardHeader'
import { CollectLabWorkflow } from './workflows/collect-lab-workflow/Workflow'
import { steps } from './workflows/collect-lab-workflow/validators'

const workflowTypes = ['collect-lab', 'enter-lab-screen', 'enter-lab-confirmation', '15-panel-instant'] as const

export function PDFUploadWizardClient() {
  // Store workflow selection in URL
  const [selectedWorkflowRaw, setSelectedWorkflow] = useQueryState(
    'workflow',
    parseAsStringLiteral(workflowTypes as readonly string[])
  )
  const selectedWorkflow = selectedWorkflowRaw as WizardType | null

  // Also manage step param to clear it when returning to selector
  // Use same parser config as Workflow.tsx and Navigation.tsx for consistency
  const [, setStep] = useQueryState(
    'step',
    parseAsStringLiteral(steps as readonly string[]).withDefault('client')
  )

  // Reset workflow selection and clear step param
  const handleBack = async () => {
    await setSelectedWorkflow(null)
    await setStep(null)
  }

  // Handle workflow type selection
  const handleWorkflowSelect = async (wizardType: WizardType) => {
    await setSelectedWorkflow(wizardType, { history: 'push' })
  }

  // Show workflow type selector if no workflow is selected
  if (!selectedWorkflow) {
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
  if (selectedWorkflow === 'collect-lab') {
    return <CollectLabWorkflow onBack={handleBack} />
  }

  if (selectedWorkflow === 'enter-lab-screen') {
    return <EnterLabScreenWorkflow onBack={handleBack} />
  }

  if (selectedWorkflow === 'enter-lab-confirmation') {
    return <EnterLabConfirmationWorkflow onBack={handleBack} />
  }

  if (selectedWorkflow === '15-panel-instant') {
    return <InstantTestWorkflow onBack={handleBack} />
  }

  return null
}
