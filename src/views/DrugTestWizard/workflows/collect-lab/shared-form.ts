import { formOptions } from '@tanstack/react-form'
import { type FormValues } from './validators'

const getDefaultValues = (): FormValues => ({
  client: {
    id: '',
    firstName: '',
    lastName: '',
    middleInitial: null,
    email: '',
    dob: null,
    headshot: null,
    headshotId: null,
    recommendedTestTypeValue: undefined,
  },
  medications: [],
  collection: {
    testType: '11-panel-lab' as const,
    collectionDate: new Date().toISOString(),
    breathalyzerTaken: false,
    breathalyzerResult: null,
  },
  emails: {
    clientEmailEnabled: false,
    clientRecipients: [],
    referralEmailEnabled: false,
    referralRecipients: [],
  },
})

// Basic form opts for withForm components that just need types (e.g., Navigation)
// Validation happens in Workflow.tsx with step-specific validators
export const collectLabFormOpts = formOptions({
  defaultValues: getDefaultValues(),
})

export const getCollectLabFormOpts = () =>
  formOptions({
    defaultValues: getDefaultValues(),
  })
