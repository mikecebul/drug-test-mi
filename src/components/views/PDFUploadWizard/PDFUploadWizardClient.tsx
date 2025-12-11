'use client'

import React, { useState } from 'react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { WizardTypeSelector } from './WizardTypeSelector'
import { CollectLabWorkflow } from './workflows/CollectLabWorkflow'
import { EnterLabScreenWorkflow } from './workflows/EnterLabScreenWorkflow'
import { EnterLabConfirmationWorkflow } from './workflows/EnterLabConfirmationWorkflow'
import { InstantTestWorkflow } from './workflows/InstantTestWorkflow'
import type { WizardType } from './types'

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
      <ShadcnWrapper className="mx-auto my-32 flex max-w-sm origin-top scale-125 flex-col md:max-w-2xl lg:mx-auto lg:max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Drug Test Workflow</h1>
          <p className="text-muted-foreground">Select the type of workflow you want to perform</p>
        </div>
        <WizardTypeSelector onSelect={handleWorkflowSelect} />
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
