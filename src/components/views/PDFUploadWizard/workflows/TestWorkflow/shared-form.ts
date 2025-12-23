import { formOptions } from '@tanstack/react-form'
import { formSchema, type FormValues } from './validators'
import { verifyClientFieldSchema } from './validators'
import { verifyMedicationsFieldSchema } from './validators'

const defaultValues: FormValues = {
  section: 'clientData',
  clientData: {
    id: '',
    firstName: '',
    lastName: '',
    middleInitial: null,
    email: '',
    dob: null,
    headshot: null,
  },
  medicationsData: {
    medications: [],
  },
}

export const testWorkflowFormOpts = formOptions({
  defaultValues,
  validators: {
    onSubmit: ({ value, formApi }) => {
      if (value.section === 'clientData') {
        return formApi.parseValuesWithSchema(verifyClientFieldSchema as typeof formSchema)
      }
      if (value.section === 'medicationsData') {
        return formApi.parseValuesWithSchema(verifyMedicationsFieldSchema as typeof formSchema)
      }
    },
  },
})
