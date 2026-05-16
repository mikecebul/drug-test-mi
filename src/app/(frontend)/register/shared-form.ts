'use client'

import { formOptions } from '@tanstack/react-form'
import {
  type FormValues,
  type Steps,
} from './validators'

const defaultValues: FormValues = {
  personalInfo: {
    firstName: '',
    lastName: '',
    middleInitial: '',
    gender: '',
    dob: '',
    phone: '',
    headshot: null,
  },
  accountInfo: {
    email: '',
    password: '',
    confirmPassword: '',
  },
  screeningType: {
    requestedBy: '' as FormValues['screeningType']['requestedBy'],
  },
  recipients: {
    additionalReferralRecipients: [],
    selectedEmployer: '',
    otherEmployerName: '',
    otherEmployerMainContactName: '',
    otherEmployerMainContactEmail: '',
    otherEmployerRecipientEmails: '',
    otherEmployerAdditionalRecipients: [],
    selectedCourt: '',
    otherCourtName: '',
    otherCourtMainContactName: '',
    otherCourtMainContactEmail: '',
    otherCourtRecipientEmails: '',
    otherCourtAdditionalRecipients: [],
  },
  medications: [] as FormValues['medications'],
  terms: {
    agreeToTerms: false as FormValues['terms']['agreeToTerms'],
  },
}

export const registerClientFormOpts = formOptions({
  defaultValues,
})

export const getRegisterClientFormOpts = (_step: Steps[number]) =>
  formOptions({
    defaultValues,
  })

export { defaultValues }
