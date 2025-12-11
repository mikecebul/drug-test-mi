'use client'

import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './form-context'
import TextareaField from '../field-components/textarea-field'
import TextField from '../field-components/text-field'
import PasswordField from '../field-components/password-field'
import CheckboxField from '../field-components/checkbox-field'
import NumberField from '../field-components/number-field'
import EmailField from '../field-components/email-field'
import PhoneField from '../field-components/phone-field'
import StateField from '../field-components/state-field'
import CountryField from '../field-components/country-field'
import SelectField from '../field-components/select-field'
import SubmitButton from '../form-components/submit-button'
import MultiSelectField from '../field-components/multi-select-field'
import DobField from '../field-components/dob-picker'
import DateField from '../field-components/date-field'
import DatePickerField from '../field-components/date-picker-field'
import FileUploadField from '../field-components/file-upload-field'
import SubstanceChecklistField from '../field-components/substance-checklist-field'
import MedicationDisplayField from '../field-components/medication-display-field'
import ParsedDataDisplayField from '../field-components/parsed-data-display-field'
import ClientSelectorField from '../field-components/client-selector-field'

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    PasswordField,
    TextareaField,
    CheckboxField,
    DobField,
    DateField,
    DatePickerField,
    NumberField,
    EmailField,
    PhoneField,
    StateField,
    CountryField,
    SelectField,
    MultiSelectField,
    FileUploadField,
    SubstanceChecklistField,
    MedicationDisplayField,
    ParsedDataDisplayField,
    ClientSelectorField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
