import { formatDateForRedwood } from '@/lib/redwood/client-fields'

function normalizeValue(value: string | null | undefined): string {
  return (value || '').trim()
}

export function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const nextChar = csv[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += char
        index += 1
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
      if (char === '\r' && nextChar === '\n') index += 1
      currentRow.push(currentCell)
      currentCell = ''
      if (currentRow.some((cell) => normalizeValue(cell))) rows.push(currentRow)
      currentRow = []
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  if (currentRow.some((cell) => normalizeValue(cell))) rows.push(currentRow)
  return rows
}

export interface RedwoodImportCSVInput {
  accountNumber: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  dob: string | Date
  intakeDate?: string | Date | null
  sex?: string | null
  group?: string | null
  phoneNumber?: string | null
}

function asCsvCell(value: string): string {
  // ToxAccess stores the quote from a standards-compliant `""` empty field
  // as the literal HTML-encoded value `&quot;`. Emit an unquoted empty field
  // so the importer receives no characters at all.
  if (value === '') return ''

  return `"${value.replace(/"/g, '""')}"`
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
    normalizeValue(input.middleInitial),
    normalizeValue(input.lastName),
    '',
    formatDateForRedwood(input.dob),
    input.intakeDate ? formatDateForRedwood(input.intakeDate) : '',
    normalizeValue(input.sex),
    normalizeValue(input.group),
    normalizeValue(input.phoneNumber),
  ]

  return `${headers.map(asCsvCell).join(',')}\n${row.map(asCsvCell).join(',')}\n`
}
