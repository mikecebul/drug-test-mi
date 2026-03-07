const DONOR_SEARCH_RESULTS_PATH = '/Pages/User/DonorSearchResults.aspx'
const DONOR_VIEW_PATH = '/Pages/User/Donor.aspx'
const DONOR_EDIT_PATH = '/Pages/User/editDonor.aspx'

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

export function extractRedwoodDonorIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const donorId = url.searchParams.get('donorid')?.trim()
    return donorId || null
  } catch {
    return null
  }
}
