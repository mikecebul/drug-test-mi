'use client'

import React, { Suspense, useState } from 'react'
import { WizardTypeSelector } from './WizardTypeSelector'
import { WizardTypeSelectorSkeleton } from './WizardTypeSelectorSkeleton'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/InstantTestWorkflow'
import type { WizardType } from './types'
import { WizardHeader } from './components/WizardHeader'
import { CollectLabWorkflow } from './workflows/collect-lab-workflow/Workflow'

export function PDFUploadWizardClient() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WizardType | null>(null)

  // Reset workflow selection
  const handleBack = () => {
    setSelectedWorkflow(null)
  }

  // Handle workflow type selection
  const handleWorkflowSelect = (wizardType: WizardType) => {
    setSelectedWorkflow(wizardType)
  }

  // Show workflow type selector if no workflow is selected
  if (!selectedWorkflow) {
    return (
      <>
        <WizardHeader
          title="Drug Test Workflow"
          description="Select the type of workflow you want to perform"
        />
        <Suspense fallback={<WizardTypeSelectorSkeleton />}>
          <WizardTypeSelector onSelect={handleWorkflowSelect} />
        </Suspense>
      </>
    )
  }

  // Route to appropriate workflow
  if (selectedWorkflow === 'collect-lab') {
    return <CollectLabWorkflow />
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
