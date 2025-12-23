'use client'

import React, { useState } from 'react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { WizardTypeSelector } from './WizardTypeSelector'
import { CollectLabWorkflow } from './workflows/CollectLabWorkflow'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/InstantTestWorkflow'
import type { WizardType } from './types'
import { WizardHeader } from './components/WizardHeader'
import { TestWorkflow } from './workflows/TestWorkflow'

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
        <WizardTypeSelector onSelect={handleWorkflowSelect} />
      </>
    )
  }

  // Route to appropriate workflow
  if (selectedWorkflow === 'collect-lab') {
    return <TestWorkflow />
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
