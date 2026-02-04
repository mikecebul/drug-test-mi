import { formOptions } from '@tanstack/react-form'
import {
  FormValues,
  steps,
  formSchema,
  uploadSchema,
  extractSchema,
  clientSchema,
  medicationsSchema,
  verifyDataSchema,
  emailsSchema,
  type Steps,
} from './validators'

const getDefaultValues = (): FormValues => ({
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
  },
  medications: [],
  verifyData: {
    testType: '15-panel-instant',
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
    referralEmailEnabled: true,
    referralRecipients: [],
  },
})

// Basic form opts (for Navigation component - just needs type info)
export const instantTestFormOpts = formOptions({
  defaultValues: getDefaultValues(),
})

// Step-aware form options (for Workflow and step components)
export const getInstantTestFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues: getDefaultValues(),
    validators: {
      onSubmit: ({ formApi }) => {
        if (step === 'upload') {
          return formApi.parseValuesWithSchema(uploadSchema as typeof formSchema)
        }
        if (step === 'extract') {
          return formApi.parseValuesWithSchema(extractSchema as typeof formSchema)
        }
        if (step === 'client') {
          return formApi.parseValuesWithSchema(clientSchema as typeof formSchema)
        }
        if (step === 'medications') {
          return formApi.parseValuesWithSchema(medicationsSchema as typeof formSchema)
        }
        if (step === 'verifyData') {
          return formApi.parseValuesWithSchema(verifyDataSchema as typeof formSchema)
        }
        if (step === 'confirm') {
          return undefined // No validation on confirm step
        }
        if (step === 'reviewEmails') {
          return formApi.parseValuesWithSchema(emailsSchema as typeof formSchema)
        }
      },
    },
  })
