import { Steps } from '../validators'

// Helper to get field names for each step
export function getFieldsForStep(step: Steps[number]): string[] {
  switch (step) {
    case 'personalInfo':
      return [
        'personalInfo.firstName',
        'personalInfo.lastName',
        'personalInfo.gender',
        'personalInfo.dob',
        'personalInfo.phone',
      ]
    case 'accountInfo':
      return ['accountInfo.noEmail', 'accountInfo.email', 'accountInfo.password', 'accountInfo.confirmPassword']
    case 'screeningType':
      return ['screeningType.requestedBy']
    case 'recipients':
      return [
        'recipients.additionalReferralRecipients',
        'recipients.selectedEmployer',
        'recipients.otherEmployerName',
        'recipients.otherEmployerMainContactName',
        'recipients.otherEmployerMainContactEmail',
        'recipients.otherEmployerRecipientEmails',
        'recipients.otherEmployerAdditionalRecipients',
        'recipients.selectedCourt',
        'recipients.otherCourtName',
        'recipients.otherCourtMainContactName',
        'recipients.otherCourtMainContactEmail',
        'recipients.otherCourtRecipientEmails',
        'recipients.otherCourtAdditionalRecipients',
      ]
    case 'terms':
      return ['terms.agreeToTerms']
    default:
      return []
  }
}
