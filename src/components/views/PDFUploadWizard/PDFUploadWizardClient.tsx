'use client'

import React, { useState } from 'react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { WizardTypeSelector } from './WizardTypeSelector'
import { CollectLabWorkflow } from './workflows/collect-lab/CollectLabWorkflow'
import { EnterLabScreenWorkflow } from './workflows/enter-lab-screen/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/enter-lab-confirmation/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/instant-test/InstantTestWorkflow'
import type { WizardType } from './types'
import { wizardContainerStyles } from './styles'
import { WizardHeader } from './components/WizardHeader'

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
      <ShadcnWrapper className="mx-auto my-32 flex max-w-lg flex-col md:max-w-4xl lg:mx-auto lg:max-w-4xl">
        <div className={wizardContainerStyles.content}>
          <WizardHeader
            title="Drug Test Workflow"
            description="Select the type of workflow you want to perform"
          />
          <WizardTypeSelector onSelect={handleWorkflowSelect} />
        </div>
      </ShadcnWrapper>
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

  // 15-panel instant workflow (existing workflow)
  return <InstantTestWorkflow onBack={handleBack} />
}
