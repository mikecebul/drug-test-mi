export function mapReferralTypeToRedwoodGroup(referralType: string | null | undefined): string {
  switch ((referralType || '').trim().toLowerCase()) {
    case 'court':
      return 'Court'
    case 'employer':
      return 'Employer'
    case 'self':
      return 'Self'
    default:
      return ''
  }
}
