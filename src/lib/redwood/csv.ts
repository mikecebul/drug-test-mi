import { format } from 'date-fns'

export type RedwoodMatchBy = 'unique-id' | 'name-dob'

export interface RedwoodExportDonor {
  uniqueId: string | null
  email: string | null
  firstName: string | null
  middleInitial: string | null
  lastName: string | null
  dobKey: string | null
  raw: Record<string, string>
}

export interface RedwoodClientMatchInput {
  uniqueId: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  dob?: string | null
}

export interface RedwoodDonorMatch {
  matchedBy: RedwoodMatchBy
  donor: RedwoodExportDonor
}

export function extractRedwoodCallInCode(donor?: RedwoodExportDonor | null): string | null {
  const value = donor?.raw.checkincode
  return value ? value.trim() : null
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeValue(value: string | null | undefined): string {
  return (value || '').trim()
}

function normalizeComparable(value: string | null | undefined): string {
  return normalizeValue(value).toLowerCase()
}

export function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const nextChar = csv[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }

      currentRow.push(currentCell)
      currentCell = ''

      if (currentRow.some((cell) => normalizeValue(cell).length > 0)) {
        rows.push(currentRow)
      }

      currentRow = []
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  if (currentRow.some((cell) => normalizeValue(cell).length > 0)) {
    rows.push(currentRow)
  }

  return rows
}

function parseDateKey(value?: string | null): string | null {
  const input = normalizeValue(value)
  if (!input) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.slice(0, 10)
  }

  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return format(parsed, 'yyyy-MM-dd')
}

function getField(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in row)) continue
    const value = normalizeValue(row[key])
    if (value) return value
  }

  return null
}

export function parseRedwoodExport(csv: string): RedwoodExportDonor[] {
  const rows = parseCSVRows(csv)
  if (rows.length <= 1) return []

  const [headerRow, ...valueRows] = rows
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header))

  const donors: RedwoodExportDonor[] = []

  for (const row of valueRows) {
    const mapped: Record<string, string> = {}
    normalizedHeaders.forEach((header, index) => {
      mapped[header] = row[index] || ''
    })

    const uniqueId = getField(mapped, ['uniqueid', 'donorid', 'id'])
    const email = getField(mapped, ['email', 'emailaddress', 'donoremail'])
    const firstName = getField(mapped, ['firstname', 'first'])
    const middleInitial = getField(mapped, ['middleinitial', 'middle'])
    const lastName = getField(mapped, ['lastname', 'last'])
    const dob = getField(mapped, ['dateofbirth', 'dob', 'birthdate'])

    donors.push({
      uniqueId,
      email,
      firstName,
      middleInitial,
      lastName,
      dobKey: parseDateKey(dob),
      raw: mapped,
    })
  }

  return donors
}

export function findRedwoodDonorMatch(
  donors: RedwoodExportDonor[],
  client: RedwoodClientMatchInput,
): RedwoodDonorMatch | null {
  const clientUniqueId = normalizeComparable(client.uniqueId)
  const clientFirstName = normalizeComparable(client.firstName)
  const clientLastName = normalizeComparable(client.lastName)
  const clientDob = parseDateKey(client.dob)

  const byUniqueId = donors.find((donor) => normalizeComparable(donor.uniqueId) === clientUniqueId)
  if (byUniqueId) {
    return { matchedBy: 'unique-id', donor: byUniqueId }
  }

  if (clientDob) {
    const byNameDob = donors.find(
      (donor) =>
        normalizeComparable(donor.firstName) === clientFirstName &&
        normalizeComparable(donor.lastName) === clientLastName &&
        donor.dobKey === clientDob,
    )

    if (byNameDob) {
      return { matchedBy: 'name-dob', donor: byNameDob }
    }
  }

  return null
}

export interface RedwoodImportCSVInput {
  accountNumber: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  uniqueId: string
  dob: string | Date
  intakeDate?: string | Date | null
  sex?: string | null
  group?: string | null
  phoneNumber?: string | null
}

function asCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function formatDob(value: string | Date): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    const dateOnlyMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch
      return `${month}/${day}/${year}`
    }

    const isoDateTimeMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})T/)
    if (isoDateTimeMatch) {
      const [, year, month, day] = isoDateTimeMatch
      return `${month}/${day}/${year}`
    }
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid DOB value for Redwood import CSV: "${String(value)}"`)
  }
  return format(parsed, 'MM/dd/yyyy')
}

export function buildRedwoodImportCSV(input: RedwoodImportCSVInput): string {
  const headers = [
    'Account Number',
    'First Name',
    'Middle Initial',
    'Last Name',
    'Unique ID',
    'Date of Birth',
    'Intake Date',
    'Sex',
    'Group',
    'Phone Number',
  ]

  const row = [
    normalizeValue(input.accountNumber),
    normalizeValue(input.firstName),
    normalizeValue(input.middleInitial || ''),
    normalizeValue(input.lastName),
    normalizeValue(input.uniqueId),
    formatDob(input.dob),
    input.intakeDate ? formatDob(input.intakeDate) : '',
    normalizeValue(input.sex || ''),
    normalizeValue(input.group || ''),
    normalizeValue(input.phoneNumber || ''),
  ]

  return `${headers.map(asCsvCell).join(',')}\n${row.map(asCsvCell).join(',')}\n`
}
