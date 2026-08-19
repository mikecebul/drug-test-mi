import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import {
  assertRedwoodDonorSaveResponse,
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  readRedwoodHtmlAttributes,
  setRedwoodFormEntry,
} from '@/lib/redwood/http'
import {
  assertRedwoodDonorAccountAllowed,
  readRedwoodCallInCodeViaHttp,
  resolveRedwoodDonorIdViaHttp,
} from '@/lib/redwood/http-donor-search'
import { formatDateForRedwood, mapGenderToRedwoodSex, normalizePhoneForRedwood } from '@/lib/redwood/client-fields'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/auth'
import { getAllowedRedwoodAccountNumbers } from '@/lib/redwood/config'
import { APP_TIMEZONE } from '@/lib/date-utils'
import type { RedwoodClientUpdateField } from '@/lib/redwood/queue'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

type RedwoodHttpUpdateClient = RedwoodDonorLookupClient & {
  createdAt: string
  gender?: string | null
  id: string
  phone?: string | null
}

type RedwoodHttpUpdatePlanEntry = {
  expectedValue: string
  field: RedwoodClientUpdateField
  formName: string
}

const REDWOOD_INTAKE_DATE_FIELD = 'ctl00$PageContent$Donor$txtIntakeDate'

function redwoodDateTimestamp(value: string): number | null {
  if (!value.trim()) return null

  try {
    const formatted = formatDateForRedwood(value)
    const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return null

    const [, month, day, year] = match
    return Date.UTC(Number(year), Number(month) - 1, Number(day))
  } catch {
    return null
  }
}

function formatClientRegistrationDateForRedwood(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Payload client creation date: "${value}".`)
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_TIMEZONE,
    year: 'numeric',
  }).format(date)
}

export function resolveRedwoodIntakeDateRepair(args: {
  clientCreatedAt: string
  currentIntakeDate: string | undefined
  expectedDob: string
}): string | null {
  const intakeTimestamp = redwoodDateTimestamp(args.currentIntakeDate || '')
  const dobTimestamp = redwoodDateTimestamp(args.expectedDob)
  const repairedIntakeDate = formatClientRegistrationDateForRedwood(args.clientCreatedAt)
  const repairedTimestamp = redwoodDateTimestamp(repairedIntakeDate)
  if (dobTimestamp === null || repairedTimestamp === null || repairedTimestamp < dobTimestamp) {
    throw new Error('Payload client creation date cannot repair the invalid Redwood intake date for this DOB update.')
  }

  if (intakeTimestamp === repairedTimestamp) return null

  return repairedIntakeDate
}

export function redwoodResponseHasValidationFailure(html: string, validatorId: string): boolean {
  for (const match of html.matchAll(/<span\b[^>]*>/gi)) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    if (attributes.id?.toLowerCase() !== validatorId.toLowerCase()) continue

    if (!/display\s*:\s*none/i.test(attributes.style || '')) return true
  }

  const escapedValidatorId = validatorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escapedValidatorId}\\.isvalid\\s*=\\s*["']false["']`, 'i').test(html)
}

function fieldValueForRedwood(client: RedwoodHttpUpdateClient, field: RedwoodClientUpdateField): string | null {
  switch (field) {
    case 'firstName':
      return client.firstName.trim()
    case 'middleInitial':
      return client.middleInitial?.trim() || ''
    case 'lastName':
      return client.lastName.trim()
    case 'dob':
      return client.dob ? formatDateForRedwood(client.dob) : ''
    case 'gender': {
      const sex = mapGenderToRedwoodSex(client.gender)
      if (!sex) return ''
      return sex === 'M' ? 'rdbMale' : 'rdbFemale'
    }
    case 'phone':
      return normalizePhoneForRedwood(client.phone)
    default:
      return null
  }
}

function formNameForRedwoodField(field: RedwoodClientUpdateField): string | null {
  switch (field) {
    case 'firstName':
      return 'ctl00$PageContent$Donor$txtFirstName'
    case 'middleInitial':
      return 'ctl00$PageContent$Donor$txtMI'
    case 'lastName':
      return 'ctl00$PageContent$Donor$txtLastName'
    case 'dob':
      return 'ctl00$PageContent$Donor$txtDateofBirth'
    case 'gender':
      return 'ctl00$PageContent$Donor$sex'
    case 'phone':
      return 'ctl00$PageContent$Donor$txtPhoneNum'
    default:
      return null
  }
}

export function buildRedwoodHttpClientUpdatePlan(args: {
  changedFields: RedwoodClientUpdateField[]
  client: RedwoodHttpUpdateClient
}): RedwoodHttpUpdatePlanEntry[] {
  const plan: RedwoodHttpUpdatePlanEntry[] = []

  for (const field of Array.from(new Set(args.changedFields))) {
    const formName = formNameForRedwoodField(field)
    const expectedValue = fieldValueForRedwood(args.client, field)
    if (!formName || expectedValue === null) continue

    plan.push({
      expectedValue,
      field,
      formName,
    })
  }

  return plan
}

function normalizeSavedRedwoodValue(field: RedwoodClientUpdateField, value: string | undefined): string {
  const trimmed = (value || '').trim()

  if (field === 'phone') {
    return normalizePhoneForRedwood(trimmed)
  }

  if (field === 'dob') {
    return trimmed ? formatDateForRedwood(trimmed) : ''
  }

  if (field === 'gender') {
    const lowered = trimmed.toLowerCase()
    if (lowered === 'rdbmale' || lowered === 'm' || lowered === 'male') return 'rdbMale'
    if (lowered === 'rdbfemale' || lowered === 'f' || lowered === 'female') return 'rdbFemale'
  }

  return trimmed
}

function assertDonorEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_txtFirstName/.test(html)) return

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP client update was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose editable donor fields for donor ${donorId}.`)
}

export async function updateRedwoodClientDetailsViaHttp(args: {
  accountNumber: string
  changedFields: RedwoodClientUpdateField[]
  client: RedwoodHttpUpdateClient
}): Promise<{
  accountNumber: string
  callInCode: string | null
  donorId: string | null
  updatedFields: RedwoodClientUpdateField[]
}> {
  const { changedFields, client } = args

  const plan = buildRedwoodHttpClientUpdatePlan({ changedFields, client })
  if (plan.length === 0) {
    throw new Error('No Redwood donor fields were eligible for direct HTTP update.')
  }

  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumbers: getAllowedRedwoodAccountNumbers(),
    client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDonorEditPage(editPage.text, donorId)
  const accountNumber = assertRedwoodDonorAccountAllowed(editPage.text, donorId)

  const editEntries = parseRedwoodFormEntries(editPage.text)
  const missingFields = plan.filter((entry) => getRedwoodFormEntry(editEntries, entry.formName) === undefined)
  if (missingFields.length > 0) {
    throw new Error(
      `Unable to locate Redwood donor form fields for direct HTTP update: ${missingFields
        .map((entry) => entry.field)
        .join(', ')}`,
    )
  }

  const alreadySynced = plan.every(
    (entry) => normalizeSavedRedwoodValue(entry.field, getRedwoodFormEntry(editEntries, entry.formName)) === entry.expectedValue,
  )
  const dobPlanEntry = plan.find((entry) => entry.field === 'dob')
  const repairedIntakeDate = dobPlanEntry
    ? resolveRedwoodIntakeDateRepair({
        clientCreatedAt: client.createdAt,
        currentIntakeDate: getRedwoodFormEntry(editEntries, REDWOOD_INTAKE_DATE_FIELD),
        expectedDob: dobPlanEntry.expectedValue,
      })
    : null

  if (alreadySynced && !repairedIntakeDate) {
    return {
      accountNumber,
      callInCode: await readRedwoodCallInCodeViaHttp({ donorId, donorSearchUrl, session }),
      donorId,
      updatedFields: plan.map((entry) => entry.field),
    }
  }

  for (const entry of plan) {
    setRedwoodFormEntry(editEntries, entry.formName, entry.expectedValue)
  }
  if (repairedIntakeDate) {
    setRedwoodFormEntry(editEntries, REDWOOD_INTAKE_DATE_FIELD, repairedIntakeDate)
  }

  setRedwoodFormEntry(editEntries, 'ctl00$PageContent$Donor$btnsave', 'Save')
  const saveResponse = await session.postFormData(editUrl, editEntries, { referer: editUrl })
  const saveHtmlPromise = saveResponse.clone().text().catch(() => '')
  await assertRedwoodDonorSaveResponse(saveResponse, 'save')
  const saveHtml = await saveHtmlPromise

  const verificationPage = await session.getText(editUrl)
  assertDonorEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)
  const verificationEntries = parseRedwoodFormEntries(verificationPage.text)
  const failedFields = plan.filter(
    (entry) =>
      normalizeSavedRedwoodValue(entry.field, getRedwoodFormEntry(verificationEntries, entry.formName)) !== entry.expectedValue,
  )
  const repairedIntakeDateFailed =
    Boolean(repairedIntakeDate) &&
    normalizeSavedRedwoodValue(
      'dob',
      getRedwoodFormEntry(verificationEntries, REDWOOD_INTAKE_DATE_FIELD),
    ) !== repairedIntakeDate
  const intakeValidationFailed = redwoodResponseHasValidationFailure(
    saveHtml,
    'PageContent_Donor_cvIntakeDate',
  )

  if ((failedFields.length > 0 || repairedIntakeDateFailed) && intakeValidationFailed) {
    throw new Error(
      `ToxAccess refused the donor update because Intake Date validation failed (submitted Intake Date: ${
        repairedIntakeDate || getRedwoodFormEntry(editEntries, REDWOOD_INTAKE_DATE_FIELD) || 'blank'
      }; submitted DOB: ${dobPlanEntry?.expectedValue || getRedwoodFormEntry(editEntries, 'ctl00$PageContent$Donor$txtDateofBirth') || 'blank'}).`,
    )
  }

  if (repairedIntakeDateFailed) {
    throw new Error('Redwood donor direct HTTP update could not verify the repaired intake date.')
  }

  if (failedFields.length > 0) {
    throw new Error(
      `Redwood donor direct HTTP update could not be verified for: ${failedFields
        .map((entry) => entry.field)
        .join(', ')}`,
    )
  }

  return {
    accountNumber,
    callInCode: await readRedwoodCallInCodeViaHttp({ donorId, donorSearchUrl, session }),
    donorId,
    updatedFields: plan.map((entry) => entry.field),
  }
}
