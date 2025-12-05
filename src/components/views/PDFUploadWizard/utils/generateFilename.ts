import { format, isValid } from 'date-fns'

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

/**
 * Generates a standardized filename for drug test PDF documents.
 *
 * @param options - The filename generation options
 * @param options.client - The client whose initials will be used in the filename
 * @param options.collectionDate - The date of specimen collection (used in filename)
 * @param options.testType - The type of drug test (e.g., '15-panel-instant', '11-panel-lab')
 * @param options.isConfirmation - Whether this is a confirmation test document
 * @returns A filename in the format "{initials}_{Lab|Instant}_{MM-dd-yy}[_Confirmation].pdf",
 *          or an empty string if required data is missing or invalid
 *
 * @example
 * // Returns "JDS_Instant_12-04-25.pdf"
 * generateTestFilename({
 *   client: { firstName: 'John', middleInitial: 'D', lastName: 'Smith' },
 *   collectionDate: '2025-12-04',
 *   testType: '15-panel-instant',
 * })
 *
 * @example
 * // Returns "JS_Lab_12-04-25_Confirmation.pdf"
 * generateTestFilename({
 *   client: { firstName: 'John', lastName: 'Smith' },
 *   collectionDate: '2025-12-04',
 *   testType: '11-panel-lab',
 *   isConfirmation: true,
 * })
 */
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

  // Validate the date before formatting to avoid throwing on invalid dates
  const parsedDate = new Date(collectionDate)
  if (!isValid(parsedDate)) {
    return ''
  }

  const date = format(parsedDate, 'MM-dd-yy')
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
