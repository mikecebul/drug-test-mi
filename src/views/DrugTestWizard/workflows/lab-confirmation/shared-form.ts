import { formOptions } from '@tanstack/react-form'
import {
  FormValues,
  steps,
  formSchema,
  uploadSchema,
  extractSchema,
  matchCollectionSchema,
  labConfirmationDataSchema,
  emailsSchema,
  type Steps,
} from './validators'

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
export const getLabConfirmationFormOpts = (step: Steps[number]) =>
  formOptions({
    defaultValues,
    validators: {
      onSubmit: ({ formApi }) => {
        if (step === 'upload') {
          return formApi.parseValuesWithSchema(uploadSchema as typeof formSchema)
        }
        if (step === 'extract') {
          return formApi.parseValuesWithSchema(extractSchema as typeof formSchema)
        }
        if (step === 'matchCollection') {
          return formApi.parseValuesWithSchema(matchCollectionSchema as typeof formSchema)
        }
        if (step === 'labConfirmationData') {
          return formApi.parseValuesWithSchema(labConfirmationDataSchema as typeof formSchema)
        }
        if (step === 'confirm') {
          return undefined // No validation on confirm step
        }
        if (step === 'emails') {
          return formApi.parseValuesWithSchema(emailsSchema as typeof formSchema)
        }
      },
    },
  })
