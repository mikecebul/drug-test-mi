import { formOptions } from '@tanstack/react-form'
import {
  clientSchema,
  collectionSchema,
  emailsSchema,
  formSchema,
  medicationsSchema,
  type FormValues,
  type Steps,
} from './validators'

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
    referralEmailEnabled: true,
    referralRecipients: [],
  },
})

// Basic form opts for withForm components that just need types (e.g., Navigation)
// Validation happens in Workflow.tsx with step-specific validators
export const collectLabFormOpts = formOptions({
  defaultValues: getDefaultValues(),
})

// Step-aware form options for Workflow.tsx
export const getCollectLabFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues: getDefaultValues(),
    validators: {
      onSubmit: ({ formApi }) => {
        if (step === 'client') {
          return formApi.parseValuesWithSchema(clientSchema as typeof formSchema)
        }
        if (step === 'medications') {
          return formApi.parseValuesWithSchema(medicationsSchema as typeof formSchema)
        }
        if (step === 'collection') {
          return formApi.parseValuesWithSchema(collectionSchema as typeof formSchema)
        }
        if (step === 'confirm') {
          return undefined
        }
        if (step === 'reviewEmails') {
          return formApi.parseValuesWithSchema(emailsSchema as typeof formSchema)
        }
      },
    },
  })
