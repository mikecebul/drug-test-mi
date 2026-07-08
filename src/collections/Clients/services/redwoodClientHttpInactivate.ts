import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'
import {
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  setRedwoodFormEntry,
  stripRedwoodHtml,
} from '@/lib/redwood/http'
import { resolveRedwoodDonorIdViaHttp } from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/playwright'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

const REDWOOD_ACTIVE_FIELD = 'ctl00$PageContent$Donor$Active'
const REDWOOD_DONOR_SAVE_BUTTON = 'ctl00$PageContent$Donor$btnsave'

export type RedwoodDonorActiveStatus = 'active' | 'inactive' | 'unknown'

export function readRedwoodDonorActiveStatus(html: string): RedwoodDonorActiveStatus {
  const entries = parseRedwoodFormEntries(html)
  const value = getRedwoodFormEntry(entries, REDWOOD_ACTIVE_FIELD)

  if (value === 'rdbActive') return 'active'
  if (value === 'rdbInActive') return 'inactive'
  return 'unknown'
}

export function buildRedwoodDonorInactivationPlan(html: string): {
  alreadyInactive: boolean
  entries: [string, string][]
} {
  const entries = parseRedwoodFormEntries(html)
  const activeStatus = readRedwoodDonorActiveStatus(html)

  if (activeStatus === 'unknown') {
    throw new Error('Redwood donor edit page did not expose the active/inactive field.')
  }

  setRedwoodFormEntry(entries, REDWOOD_ACTIVE_FIELD, 'rdbInActive')

  return {
    alreadyInactive: activeStatus === 'inactive',
    entries,
  }
}

function assertDonorEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_txtFirstName/.test(html) && /PageContent_Donor_rdbInActive/.test(html)) {
    return
  }

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP inactivation was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose inactive controls for donor ${donorId}.`)
}

export async function inactivateRedwoodClientViaHttp(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient & {
    id: string
  }
}): Promise<{
  donorId: string
  screenshotPath: string
  status: 'synced'
}> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumber: args.accountNumber,
    client: args.client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDonorEditPage(editPage.text, donorId)
  const plan = buildRedwoodDonorInactivationPlan(editPage.text)

  if (plan.alreadyInactive) {
    return {
      donorId,
      screenshotPath: '',
      status: 'synced',
    }
  }

  setRedwoodFormEntry(plan.entries, REDWOOD_DONOR_SAVE_BUTTON, 'Save')
  const saveResponse = await session.postFormData(editUrl, plan.entries, { referer: editUrl })
  const saveLocation = saveResponse.headers.get('location')
  if (saveResponse.status !== 302 || !saveLocation || !/Donor\.aspx/i.test(saveLocation)) {
    const body = await saveResponse.text().catch(() => '')
    throw new Error(
      `Redwood donor direct HTTP inactivation save failed with status ${saveResponse.status}: ${stripRedwoodHtml(body).slice(0, 500)}`,
    )
  }

  const verificationPage = await session.getText(editUrl)
  assertDonorEditPage(verificationPage.text, donorId)

  if (readRedwoodDonorActiveStatus(verificationPage.text) !== 'inactive') {
    throw new Error('Redwood donor direct HTTP inactivation could not be verified on the donor edit page.')
  }

  return {
    donorId,
    screenshotPath: '',
    status: 'synced',
  }
}
