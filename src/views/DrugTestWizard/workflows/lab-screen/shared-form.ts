import { formOptions } from '@tanstack/react-form'
import {
  FormValues,
  steps,
  formSchema,
  uploadSchema,
  extractSchema,
  matchCollectionSchema,
  labScreenDataSchema,
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
export const getLabScreenFormOpts = (step: Steps[number]) =>
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
        if (step === 'matchCollection') {
          return formApi.parseValuesWithSchema(matchCollectionSchema as typeof formSchema)
        }
        if (step === 'labScreenData') {
          return formApi.parseValuesWithSchema(labScreenDataSchema as typeof formSchema)
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
