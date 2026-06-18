import { formOptions } from '@tanstack/react-form'
import { FormValues } from './validators'

export type InstantTestType = '17-panel-instant'

const getDefaultValues = (testType: InstantTestType = '17-panel-instant'): FormValues => ({
  upload: {
    file: null as unknown as File, // Will be set by user
  },
  extract: {
    extracted: false,
    clientMismatchConfirmed: false,
    clientMismatchConfirmationKey: null,
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
    collectionDate: '',
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

export const getInstantTestFormOpts = (testType: InstantTestType = '17-panel-instant') =>
  formOptions({
    defaultValues: getDefaultValues(testType),
  })
