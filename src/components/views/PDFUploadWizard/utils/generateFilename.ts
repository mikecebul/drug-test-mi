import { format } from 'date-fns'

interface Client {
  firstName: string
  lastName: string
  middleInitial?: string | null
}

interface GenerateFilenameOptions {
  client: Client | null
  collectionDate: string | Date | null
  testType: string
  isConfirmation?: boolean
}

export function generateTestFilename({
  client,
  collectionDate,
  testType,
  isConfirmation = false,
}: GenerateFilenameOptions): string {
  if (!client || !collectionDate) {
    return ''
  }

  const firstInitial = client.firstName?.charAt(0)?.toUpperCase() || ''
  const middleInitial = client.middleInitial?.charAt(0)?.toUpperCase() || ''
  const lastInitial = client.lastName?.charAt(0)?.toUpperCase() || ''

  const initials = middleInitial
    ? `${firstInitial}${middleInitial}${lastInitial}`
    : `${firstInitial}${lastInitial}`

  // Return empty if we don't have enough data
  if (!initials || initials.length < 2) {
    return ''
  }

  const date = format(new Date(collectionDate), 'MM-dd-yy')
  const testTypePrefix =
    testType === '11-panel-lab'
      ? 'Lab'
      : testType === '17-panel-sos-lab'
        ? 'Lab'
        : testType === 'etg-lab'
          ? 'Lab'
          : 'Instant'

  const suffix = isConfirmation ? '_Confirmation' : ''
  return `${initials}_${testTypePrefix}_${date}${suffix}.pdf`
}
