import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import {
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
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
import type { RedwoodClientUpdateField } from '@/lib/redwood/queue'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

type RedwoodHttpUpdateClient = RedwoodDonorLookupClient & {
  gender?: string | null
  id: string
  phone?: string | null
}

type RedwoodHttpUpdatePlanEntry = {
  expectedValue: string
  field: RedwoodClientUpdateField
  formName: string
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

  if (alreadySynced) {
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

  setRedwoodFormEntry(editEntries, 'ctl00$PageContent$Donor$btnsave', 'Save')
  const saveResponse = await session.postFormData(editUrl, editEntries, { referer: editUrl })
  const saveLocation = saveResponse.headers.get('location')
  if (saveResponse.status !== 302 || !saveLocation || !/Donor\.aspx/i.test(saveLocation)) {
    throw new Error(`Redwood donor direct HTTP save failed with status ${saveResponse.status}.`)
  }

  const verificationPage = await session.getText(editUrl)
  assertDonorEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)
  const verificationEntries = parseRedwoodFormEntries(verificationPage.text)
  const failedFields = plan.filter(
    (entry) =>
      normalizeSavedRedwoodValue(entry.field, getRedwoodFormEntry(verificationEntries, entry.formName)) !== entry.expectedValue,
  )

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
