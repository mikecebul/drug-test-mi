import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'
import {
  createRedwoodHttpSession,
  parseRedwoodFormEntries,
  setRedwoodFormEntry,
  stripRedwoodHtml,
} from '@/lib/redwood/http'
import {
  assertRedwoodDonorAccountAllowed,
  readRedwoodDonorActiveStatus,
  resolveRedwoodDonorIdViaHttp,
} from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/auth'
import { getAllowedRedwoodAccountNumbers } from '@/lib/redwood/config'

export { readRedwoodDonorActiveStatus }

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

const REDWOOD_ACTIVE_FIELD = 'ctl00$PageContent$Donor$Active'
const REDWOOD_DONOR_SAVE_BUTTON = 'ctl00$PageContent$Donor$btnsave'

export function clearRedwoodDonorGroup(entries: [string, string][]): boolean {
  const groupEntries = entries.filter(([name]) =>
    /PageContent\$Donor[^$]*\$.*group|PageContent\$Donor\$.*group/i.test(name),
  )
  for (const entry of groupEntries) {
    entry[1] = ''
  }
  return groupEntries.length > 0
}

export function buildRedwoodDonorActiveStatusPlan(
  html: string,
  active: boolean,
): {
  alreadySynced: boolean
  entries: [string, string][]
} {
  const entries = parseRedwoodFormEntries(html)
  const activeStatus = readRedwoodDonorActiveStatus(html)

  if (activeStatus === 'unknown') {
    throw new Error('Redwood donor edit page did not expose the active/inactive field.')
  }

  const expectedStatus = active ? 'active' : 'inactive'
  setRedwoodFormEntry(entries, REDWOOD_ACTIVE_FIELD, active ? 'rdbActive' : 'rdbInActive')

  return {
    alreadySynced: activeStatus === expectedStatus,
    entries,
  }
}

export function buildRedwoodDonorInactivationPlan(html: string): {
  alreadyInactive: boolean
  entries: [string, string][]
} {
  const plan = buildRedwoodDonorActiveStatusPlan(html, false)
  return {
    alreadyInactive: plan.alreadySynced,
    entries: plan.entries,
  }
}

function assertDonorEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_txtFirstName/.test(html) && /PageContent_Donor_rdbInActive/.test(html)) {
    return
  }

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP inactivation was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose active-status controls for donor ${donorId}.`)
}

export async function setRedwoodClientActiveStatusViaHttp(args: {
  active: boolean
  accountNumber: string
  client: RedwoodDonorLookupClient & {
    id: string
  }
}): Promise<{
  accountNumber: string
  donorId: string
  status: 'synced'
}> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumbers: getAllowedRedwoodAccountNumbers(),
    client: args.client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDonorEditPage(editPage.text, donorId)
  const accountNumber = assertRedwoodDonorAccountAllowed(editPage.text, donorId)
  const plan = buildRedwoodDonorActiveStatusPlan(editPage.text, args.active)

  if (args.active && !clearRedwoodDonorGroup(plan.entries)) {
    throw new Error('Redwood donor edit page did not expose the donor group field required for reactivation.')
  }

  if (plan.alreadySynced) {
    return {
      accountNumber,
      donorId,
      status: 'synced',
    }
  }

  setRedwoodFormEntry(plan.entries, REDWOOD_DONOR_SAVE_BUTTON, 'Save')
  const saveResponse = await session.postFormData(editUrl, plan.entries, { referer: editUrl })
  const saveLocation = saveResponse.headers.get('location')
  if (saveResponse.status !== 302 || !saveLocation || !/Donor\.aspx/i.test(saveLocation)) {
    const body = await saveResponse.text().catch(() => '')
    throw new Error(
      `Redwood donor direct HTTP active-status save failed with status ${saveResponse.status}: ${stripRedwoodHtml(body).slice(0, 500)}`,
    )
  }

  const verificationPage = await session.getText(editUrl)
  assertDonorEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)

  const expectedStatus = args.active ? 'active' : 'inactive'
  if (readRedwoodDonorActiveStatus(verificationPage.text) !== expectedStatus) {
    throw new Error(`Redwood donor direct HTTP ${expectedStatus} status could not be verified on the donor edit page.`)
  }

  return {
    accountNumber,
    donorId,
    status: 'synced',
  }
}

export async function inactivateRedwoodClientViaHttp(
  args: Omit<Parameters<typeof setRedwoodClientActiveStatusViaHttp>[0], 'active'>,
) {
  return setRedwoodClientActiveStatusViaHttp({ ...args, active: false })
}
