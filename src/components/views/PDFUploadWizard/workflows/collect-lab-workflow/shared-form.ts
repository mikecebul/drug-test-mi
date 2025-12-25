import { formOptions } from '@tanstack/react-form'
import { collectionSchema, formSchema, type FormValues } from './validators'
import { clientSchema } from './validators'
import { medicationsSchema } from './validators'

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
    collectionDate: new Date().toISOString().split('T')[0],
    collectionTime: new Date().toTimeString().slice(0, 5),
    breathalyzerTaken: false,
    breathalyzerResult: null,
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
    },
  },
})
