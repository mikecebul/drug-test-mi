import { formOptions } from '@tanstack/react-form'
import { FormValues, steps, type Steps } from './validators'

const defaultValues: FormValues = {
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
  labConfirmationData: {
    originalDetectedSubstances: [],
    originalIsDilute: false,
    confirmationResults: [],
  },
  emails: {
    clientEmailEnabled: true, // Default true for complete stage (results are final)
    clientRecipients: [],
    referralEmailEnabled: false,
    referralRecipients: [],
  },
}

// Export steps for Navigation component
export { steps }

// Basic form opts (for Navigation component - just needs type info)
export const labConfirmationFormOpts = formOptions({
  defaultValues,
})

// Step-aware form options (for Workflow and step components)
export const getLabConfirmationFormOpts = (_step: Steps[number]) =>
  formOptions({
    defaultValues,
  })
