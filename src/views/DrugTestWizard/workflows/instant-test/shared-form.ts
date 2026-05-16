import { formOptions } from '@tanstack/react-form'
import { FormValues, type Steps } from './validators'

export type InstantTestType = '15-panel-instant' | '17-panel-instant'

const getDefaultValues = (testType: InstantTestType = '15-panel-instant'): FormValues => ({
  upload: {
    file: null as any, // Will be set by user
  },
  extract: {
    extracted: false,
  },
  client: {
    id: '',
    firstName: '',
    lastName: '',
    middleInitial: null,
    email: '',
    dob: null,
    headshot: null,
    headshotId: null,
  },
  medications: [],
  verifyData: {
    testType,
    collectionDate: new Date().toISOString(),
    detectedSubstances: [],
    isDilute: false,
    breathalyzerTaken: false,
    breathalyzerResult: null,
    confirmationDecisionRequired: false,
    confirmationDecision: undefined,
    confirmationSubstances: [],
  },
  emails: {
    clientEmailEnabled: true, // Default to true for instant tests (results available immediately)
    clientRecipients: [],
    referralEmailEnabled: false,
    referralRecipients: [],
  },
})

// Basic form opts (for Navigation component - just needs type info)
export const instantTestFormOpts = formOptions({
  defaultValues: getDefaultValues(),
})

// Step-aware form options (for Workflow and step components)
export const getInstantTestFormOpts = (_step: Steps[number], testType: InstantTestType = '15-panel-instant') =>
  formOptions({
    defaultValues: getDefaultValues(testType),
  })
