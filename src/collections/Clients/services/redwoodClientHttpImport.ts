import { buildRedwoodImportCSV, type RedwoodImportCSVInput } from '@/lib/redwood/csv'
import {
  createRedwoodHttpSession,
  parseRedwoodFormEntries,
  readRedwoodHtmlAttributes,
  setRedwoodFormEntry,
  stripRedwoodHtml,
} from '@/lib/redwood/http'
import {
  findExistingActiveRedwoodDonorViaHttp,
  findExistingInactiveRedwoodDonorViaHttp,
  findRedwoodDonorByNameDobViaHttp,
  readRedwoodCallInCodeViaHttp,
} from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/auth'
import { setRedwoodClientActiveStatusViaHttp } from './redwoodClientHttpInactivate'

export { readRedwoodDonorSearchResults } from '@/lib/redwood/http-donor-search'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const DEFAULT_REDWOOD_IMPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ImportDonors.aspx'

const REDWOOD_IMPORT_FILE_FIELD = 'ctl00$PageContent$ImportDonor1$FileUpload1'
const REDWOOD_IMPORT_UPLOAD_BUTTON = 'ctl00$PageContent$ImportDonor1$btnImport'

type RedwoodHttpImportStatus = 'imported' | 'matched-existing' | 'reactivated-existing'

export type RedwoodHttpImportedDonor = {
  accountNumber: string
  callInCode: string | null
  donorId: string
  matchedBy?: 'name-dob'
  matchedDonorName: string | null
  status: RedwoodHttpImportStatus
}

export type RedwoodDonorCreationOptions = {
  allowCreate?: boolean
  blockedReason?: string
  searchAccountNumbers?: string[]
}

export function assertRedwoodDonorCreationAllowed(options: RedwoodDonorCreationOptions = {}): void {
  if (options.allowCreate !== false) return

  throw new Error(
    options.blockedReason ||
      'Potential existing Redwood donor: automatic creation was blocked because donor identity requires manual review.',
  )
}

function readNamedFormControl(html: string, name: string): { name: string; type: string; value: string } | null {
  for (const match of html.matchAll(/<(input|button)\b[^>]*>/gi)) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    if (attributes.name !== name) continue

    return {
      name: attributes.name,
      type: attributes.type || '',
      value: attributes.value || stripRedwoodHtml(match[0]),
    }
  }

  return null
}

export function readRedwoodImportFinalSubmitControl(html: string): { name: string; value: string } | null {
  const controls = Array.from(html.matchAll(/<(input|button)\b[^>]*>/gi)).map((match) => {
    const attributes = readRedwoodHtmlAttributes(match[0])
    return {
      name: attributes.name || '',
      type: attributes.type || '',
      value: attributes.value || stripRedwoodHtml(match[0]),
    }
  })

  const control = controls.find(
    (candidate) =>
      candidate.name &&
      /submit|finish|complete|continue/i.test(`${candidate.name} ${candidate.value}`) &&
      !/upload|importdonor1\$btnimport|download|template|cancel/i.test(`${candidate.name} ${candidate.value}`),
  )

  return control
    ? {
        name: control.name,
        value: control.value,
      }
    : null
}

function readImportSummary(html: string): string {
  const textareaText = Array.from(html.matchAll(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi))
    .map((match) => stripRedwoodHtml(match[1] || '').trim())
    .filter(Boolean)
    .join('\n')
  return `${textareaText}\n${stripRedwoodHtml(html)}`.toLowerCase()
}

function isImportRejectionSummary(summary: string): boolean {
  const rejectedCount = summary.match(/(\d+)\s+donor\(s\)\s+rejected/)?.[1]
  const failedCount = summary.match(/(\d+)\s+(?:record|records|donor|donors)\s+failed/)?.[1]
  const hasRejectedRows = rejectedCount ? Number.parseInt(rejectedCount, 10) > 0 : false
  const hasFailedRows = failedCount ? Number.parseInt(failedCount, 10) > 0 : false

  return (
    hasRejectedRows ||
    hasFailedRows ||
    summary.includes('rejected record') ||
    summary.includes('rejected records') ||
    summary.includes('reason 1') ||
    summary.includes('import rejected')
  )
}

function isImportProcessedSummary(summary: string): boolean {
  return (
    summary.includes('successfully imported') ||
    summary.includes('import complete') ||
    summary.includes('import completed') ||
    summary.includes('records processed') ||
    summary.includes('processed successfully') ||
    summary.includes('donor imported') ||
    /\d+\s+donor\(s\)\s+imported/.test(summary) ||
    /\d+\s+record(?:s)?\s+processed/.test(summary)
  )
}

export function assertRedwoodImportDidNotReject(html: string): void {
  const summary = readImportSummary(html)
  if (!summary.trim()) return

  if (isImportRejectionSummary(summary)) {
    throw new Error(`Redwood donor import was rejected: ${summary.slice(0, 1000)}`)
  }
}

export function assertRedwoodImportUploadAdvanced(html: string): void {
  const stillHasUploadButton = readNamedFormControl(html, REDWOOD_IMPORT_UPLOAD_BUTTON) !== null
  const stillHasFileInput = readNamedFormControl(html, REDWOOD_IMPORT_FILE_FIELD) !== null
  const isStillUploadPage = stillHasUploadButton && stillHasFileInput
  const summary = readImportSummary(html)

  if (isStillUploadPage && !readRedwoodImportFinalSubmitControl(html) && !isImportProcessedSummary(summary)) {
    throw new Error('Redwood donor import upload did not reach review or processed state.')
  }
}

export async function createRedwoodClientViaHttp(
  input: RedwoodImportCSVInput,
  creationOptions: RedwoodDonorCreationOptions = {},
): Promise<RedwoodHttpImportedDonor> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const importUrl = process.env.REDWOOD_IMPORT_URL?.trim() || DEFAULT_REDWOOD_IMPORT_URL
  const session = await createRedwoodHttpSession(auth)
  const searchAccountNumbers = Array.from(
    new Set(
      (creationOptions.searchAccountNumbers?.length
        ? creationOptions.searchAccountNumbers
        : [input.accountNumber]
      )
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
  const lookupClient = {
    dob: typeof input.dob === 'string' ? input.dob : input.dob.toISOString(),
    firstName: input.firstName,
    lastName: input.lastName,
    middleInitial: input.middleInitial,
  }

  const existing = await findExistingActiveRedwoodDonorViaHttp({
    accountNumbers: searchAccountNumbers,
    client: lookupClient,
    donorSearchUrl,
    session,
  })
  const inactive = await findExistingInactiveRedwoodDonorViaHttp({
    accountNumbers: searchAccountNumbers,
    client: lookupClient,
    donorSearchUrl,
    session,
  })

  if (existing && inactive) {
    throw new Error(
      `DOB-verified Redwood donor matches were found in both active account ${existing.accountNumber} and inactive account ${inactive.accountNumber}; manual review required.`,
    )
  }

  if (existing) {
    return {
      accountNumber: existing.accountNumber,
      callInCode: await readRedwoodCallInCodeViaHttp({ donorId: existing.donorId, donorSearchUrl, session }),
      donorId: existing.donorId,
      matchedBy: existing.matchedBy,
      matchedDonorName: existing.matchedDonorName,
      status: 'matched-existing',
    }
  }

  if (inactive) {
    await setRedwoodClientActiveStatusViaHttp({
      accountNumber: inactive.accountNumber,
      active: true,
      client: {
        dob: lookupClient.dob,
        firstName: input.firstName,
        id: `redwood-donor-${inactive.donorId}`,
        lastName: input.lastName,
        middleInitial: input.middleInitial,
        redwoodAccountNumber: inactive.accountNumber,
        redwoodDonorId: inactive.donorId,
      },
    })

    return {
      accountNumber: inactive.accountNumber,
      callInCode: await readRedwoodCallInCodeViaHttp({ donorId: inactive.donorId, donorSearchUrl, session }),
      donorId: inactive.donorId,
      matchedBy: inactive.matchedBy,
      matchedDonorName: inactive.matchedDonorName,
      status: 'reactivated-existing',
    }
  }

  assertRedwoodDonorCreationAllowed(creationOptions)

  const importPage = await session.getText(importUrl)
  const uploadEntries = parseRedwoodFormEntries(importPage.text)
  setRedwoodFormEntry(uploadEntries, REDWOOD_IMPORT_UPLOAD_BUTTON, 'Upload')

  const csv = buildRedwoodImportCSV(input)
  const uploadResponse = await session.postMultipart(importUrl, uploadEntries, {
    files: [
      {
        blob: new Blob([csv], { type: 'text/csv' }),
        filename: `redwood-import-${input.lastName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.csv`,
        name: REDWOOD_IMPORT_FILE_FIELD,
      },
    ],
    referer: importUrl,
  })
  let resultHtml = await uploadResponse.text()
  assertRedwoodImportDidNotReject(resultHtml)

  let imported = await findRedwoodDonorByNameDobViaHttp({
    accountNumber: input.accountNumber,
    client: lookupClient,
    donorSearchUrl,
    session,
  })
  if (imported) {
    return {
      accountNumber: imported.accountNumber,
      callInCode: await readRedwoodCallInCodeViaHttp({ donorId: imported.donorId, donorSearchUrl, session }),
      donorId: imported.donorId,
      matchedDonorName: imported.matchedDonorName,
      status: 'imported',
    }
  }

  const submitControl = readRedwoodImportFinalSubmitControl(resultHtml)
  if (submitControl) {
    const submitEntries = parseRedwoodFormEntries(resultHtml)
    setRedwoodFormEntry(submitEntries, submitControl.name, submitControl.value || 'Submit')
    const submitResponse = await session.postFormData(importUrl, submitEntries, { referer: importUrl })
    resultHtml = await submitResponse.text().catch(() => '')
    assertRedwoodImportDidNotReject(resultHtml)

    const resultSummary = readImportSummary(resultHtml)
    if (readRedwoodImportFinalSubmitControl(resultHtml) && !isImportProcessedSummary(resultSummary)) {
      throw new Error('Redwood donor import final submit did not complete.')
    }
  } else {
    assertRedwoodImportUploadAdvanced(resultHtml)
  }

  imported = await findRedwoodDonorByNameDobViaHttp({
    accountNumber: input.accountNumber,
    client: lookupClient,
    donorSearchUrl,
    session,
  })
  if (!imported) {
    throw new Error('Redwood donor import completed, but the imported donor could not be resolved by name and DOB.')
  }

  return {
    accountNumber: imported.accountNumber,
    callInCode: await readRedwoodCallInCodeViaHttp({ donorId: imported.donorId, donorSearchUrl, session }),
    donorId: imported.donorId,
    matchedDonorName: imported.matchedDonorName,
    status: 'imported',
  }
}
