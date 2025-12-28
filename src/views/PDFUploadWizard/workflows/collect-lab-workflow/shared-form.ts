import { formOptions } from '@tanstack/react-form'
import { collectionSchema, formSchema, type FormValues } from './validators'
import { clientSchema } from './validators'
import { medicationsSchema } from './validators'
import { emailsSchema } from './validators'

const defaultValues: FormValues = {
  step: 'client',
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
  collection: {
    testType: '11-panel-lab' as const,
    collectionDate: new Date().toISOString(),
    breathalyzerTaken: false,
    breathalyzerResult: null,
  },
  emails: {
    referralEmailEnabled: true,
    referralRecipients: [],
  },
}

export const collectLabFormOpts = formOptions({
  defaultValues,
  validators: {
    onSubmit: ({ value, formApi }) => {
      if (value.step === 'client') {
        return formApi.parseValuesWithSchema(clientSchema as typeof formSchema)
      }
      if (value.step === 'medications') {
        return formApi.parseValuesWithSchema(medicationsSchema as typeof formSchema)
      }
      if (value.step === 'collection') {
        return formApi.parseValuesWithSchema(collectionSchema as typeof formSchema)
      }
      if (value.step === 'confirm') {
        return
      }
      if (value.step === 'reviewEmails') {
        return formApi.parseValuesWithSchema(emailsSchema as typeof formSchema)
      }
    },
  },
})
