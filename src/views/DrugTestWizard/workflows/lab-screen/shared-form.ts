import { formOptions } from '@tanstack/react-form'
import { FormValues, steps, type Steps } from './validators'

const getDefaultValues = (): FormValues => ({
  upload: {
    file: null as any, // Will be set by user
  },
  extract: {
    extracted: false,
  },
  matchCollection: {
    testId: '',
    clientName: '',
    headshot: '',
    testType: '',
    collectionDate: '',
    screeningStatus: '',
    matchType: 'manual' as const,
    score: 0,
  },
  labScreenData: {
    testType: '11-panel-lab' as const,
    collectionDate: new Date().toISOString(),
    detectedSubstances: [],
    isDilute: false,
    confirmationDecisionRequired: false,
    confirmationDecision: undefined,
    confirmationSubstances: [],
  },
  emails: {
    clientEmailEnabled: true,
    clientRecipients: [],
    referralEmailEnabled: false,
    referralRecipients: [],
  },
})

// Export steps for Navigation component
export { steps }

// Basic form opts (for Navigation component - just needs type info)
export const labScreenFormOpts = formOptions({
  defaultValues: getDefaultValues(),
})

// Step-aware form options (for Workflow and step components)
export const getLabScreenFormOpts = (_step: Steps[number]) =>
  formOptions({
    defaultValues: getDefaultValues(),
  })
