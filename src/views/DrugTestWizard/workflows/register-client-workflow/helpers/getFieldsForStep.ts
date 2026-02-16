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
        'recipients.useSelfAsRecipient',
        'recipients.alternativeRecipientName',
        'recipients.alternativeRecipientEmail',
        'recipients.selectedEmployer',
        'recipients.employerName',
        'recipients.contactName',
        'recipients.contactEmail',
        'recipients.selectedCourt',
        'recipients.courtName',
        'recipients.probationOfficerName',
        'recipients.probationOfficerEmail',
      ]
    case 'terms':
      return ['terms.agreeToTerms']
    default:
      return []
  }
}
