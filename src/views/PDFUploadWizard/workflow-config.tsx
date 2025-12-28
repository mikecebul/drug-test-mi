import type { WizardType, WizardStep } from './types'
import type { Step } from '@/components/ui/stepper'

/**
 * Workflow configuration defining steps for each wizard type
 */
export interface WorkflowConfig {
  steps: Step[]
  stepComponents: Record<number, WizardStep>
  requiresPDF: boolean
  requiresExtraction: boolean
  requiresTestSelection: boolean
  isUpdate: boolean // true if updating existing test, false if creating new
}

export const workflowConfigs: Record<WizardType, WorkflowConfig> = {
  '15-panel-instant': {
    steps: [
      { id: 'wizard-type', label: 'Type' },
      { id: 'upload', label: 'Upload' },
      { id: 'extract', label: 'Extract' },
      { id: 'verify-client', label: 'Client' },
      { id: 'verify-data', label: 'Verify' },
      { id: 'confirm', label: 'Confirm' },
      { id: 'review-emails', label: 'Emails' },
    ],
    stepComponents: {
      1: 'wizard-type',
      2: 'upload',
      3: 'extract',
      4: 'verify-client',
      5: 'verify-data',
      6: 'confirm',
      7: 'review-emails',
    },
    requiresPDF: true,
    requiresExtraction: true,
    requiresTestSelection: false,
    isUpdate: false,
  },

  'collect-lab': {
    steps: [
      { id: 'wizard-type', label: 'Type' },
      { id: 'verify-client', label: 'Client' },
      { id: 'collection-details', label: 'Details' },
      { id: 'confirm', label: 'Confirm' },
    ],
    stepComponents: {
      1: 'wizard-type',
      2: 'verify-client',
      3: 'collection-details',
      4: 'confirm',
    },
    requiresPDF: false,
    requiresExtraction: false,
    requiresTestSelection: false,
    isUpdate: false,
  },

  'enter-lab-screen': {
    steps: [
      { id: 'wizard-type', label: 'Type' },
      { id: 'select-test', label: 'Select Test' },
      { id: 'upload', label: 'Upload' },
      { id: 'extract', label: 'Extract' },
      { id: 'verify-data', label: 'Verify' },
      { id: 'confirm', label: 'Confirm' },
      { id: 'review-emails', label: 'Emails' },
    ],
    stepComponents: {
      1: 'wizard-type',
      2: 'select-test',
      3: 'upload',
      4: 'extract',
      5: 'verify-data',
      6: 'confirm',
      7: 'review-emails',
    },
    requiresPDF: true,
    requiresExtraction: true,
    requiresTestSelection: true,
    isUpdate: true,
  },

  'enter-lab-confirmation': {
    steps: [
      { id: 'wizard-type', label: 'Type' },
      { id: 'select-test', label: 'Select Test' },
      { id: 'upload', label: 'Upload' },
      { id: 'extract', label: 'Extract' },
      { id: 'confirm', label: 'Confirm' },
    ],
    stepComponents: {
      1: 'wizard-type',
      2: 'select-test',
      3: 'upload',
      4: 'extract',
      5: 'confirm',
    },
    requiresPDF: true,
    requiresExtraction: true,
    requiresTestSelection: true,
    isUpdate: true,
  },
}

/**
 * Get the workflow configuration for a given wizard type
 */
export function getWorkflowConfig(wizardType: WizardType): WorkflowConfig {
  return workflowConfigs[wizardType]
}

/**
 * Get the step ID for a given step number in a workflow
 */
export function getStepId(wizardType: WizardType, stepNumber: number): WizardStep {
  const config = workflowConfigs[wizardType]
  return config.stepComponents[stepNumber]
}
