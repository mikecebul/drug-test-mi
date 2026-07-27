const DONOR_SEARCH_RESULTS_PATH = '/Pages/User/DonorSearchResults.aspx'
const DONOR_VIEW_PATH = '/Pages/User/Donor.aspx'
const DONOR_EDIT_PATH = '/Pages/User/editDonor.aspx'
const COLLECTION_START_STEP = 1

export const REDWOOD_DESKTOP_DONOR_SEARCH_URL =
  'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
export const REDWOOD_MOBILE_DONORS_URL = 'https://m.toxaccess.com/donors'

function createRedwoodUrl(baseUrl: string, pathname: string): URL {
  const url = new URL(baseUrl)
  url.pathname = pathname
  url.search = ''
  return url
}

export function buildRedwoodDonorSearchResultsUrl(args: {
  donorSearchUrl: string
  uniqueId?: string | null
  lastName?: string | null
  firstName?: string | null
  accountNumber?: string | null
  active?: boolean
}): string {
  const { donorSearchUrl, uniqueId, lastName, firstName, accountNumber, active = true } = args
  const url = createRedwoodUrl(donorSearchUrl, DONOR_SEARCH_RESULTS_PATH)

  if (uniqueId?.trim()) {
    url.searchParams.set('uniqueID', uniqueId.trim())
  }

  if (firstName?.trim()) {
    url.searchParams.set('name', firstName.trim())
  }

  if (lastName?.trim()) {
    url.searchParams.set('lastName', lastName.trim())
  }

  if (accountNumber?.trim()) {
    url.searchParams.set('agency', accountNumber.trim())
  }

  url.searchParams.set('active', active ? 'True' : 'False')
  return url.toString()
}

export function buildRedwoodDonorViewUrl(donorSearchUrl: string, donorId: string): string {
  const url = createRedwoodUrl(donorSearchUrl, DONOR_VIEW_PATH)
  url.searchParams.set('donorid', donorId.trim())
  return url.toString()
}

export function buildRedwoodDonorEditUrl(donorSearchUrl: string, donorId: string): string {
  const url = createRedwoodUrl(donorSearchUrl, DONOR_EDIT_PATH)
  url.searchParams.set('donorid', donorId.trim())
  return url.toString()
}

export function buildRedwoodCollectSpecimenUrl(donorSearchUrl: string, donorId: string, isOnSite: boolean): string {
  const url = createRedwoodUrl(
    donorSearchUrl,
    `/donors/${encodeURIComponent(donorId.trim())}/collection/steps/${COLLECTION_START_STEP}`,
  )
  url.searchParams.set('isOnSite', isOnSite ? 'true' : 'false')
  return url.toString()
}

export function resolveGuidedToxAccessHref(args: {
  donorId?: string | null
  mobileHref: string
  useDesktopSite: boolean
}): string {
  if (!args.useDesktopSite) return args.mobileHref
  if (args.donorId?.trim()) {
    return buildRedwoodDonorViewUrl(REDWOOD_DESKTOP_DONOR_SEARCH_URL, args.donorId)
  }
  return REDWOOD_DESKTOP_DONOR_SEARCH_URL
}

export function extractRedwoodDonorIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const donorId = url.searchParams.get('donorid')?.trim()
    return donorId || null
  } catch {
    return null
  }
}
