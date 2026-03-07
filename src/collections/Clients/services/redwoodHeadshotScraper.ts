import { calculateNameSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'
import { getRedwoodAccountNumber } from '@/lib/redwood/config'
import {
  buildRedwoodDonorEditUrl,
  buildRedwoodDonorSearchResultsUrl,
  buildRedwoodDonorViewUrl,
  extractRedwoodDonorIdFromUrl,
} from '@/lib/redwood/donor-urls'
import {
  clickFirstVisible,
  fillFirstVisibleInput,
  loginToRedwood,
  openRedwoodBrowserContext,
  resolveRedwoodAuthEnv,
} from '@/lib/redwood/playwright'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const DONOR_AMBIGUOUS_SCORE_DELTA = 0.02
const NAME_ONLY_MIN_SCORE = 0.85

interface RedwoodClient {
  firstName: string
  lastName: string
  middleInitial?: string
  dob?: string
  redwoodUniqueId?: string
  redwoodDonorId?: string
}

interface DonorCandidate {
  rowIndex: number
  fullName: string
  firstName: string
  lastName: string
  middleInitial?: string
  dobText?: string
  dobKey?: string
  score: number
}

export interface RedwoodHeadshotScrapeResult {
  imageBuffer: Buffer
  mimeType: string
  fileName: string
  matchedDonorName: string
  donorId?: string
  callInCode?: string | null
}

const REDWOOD_HEADSHOT_PULL_RETRY_ATTEMPTS = 4
const REDWOOD_HEADSHOT_PULL_RETRY_DELAY_MS = 3000

const VIEW_CONTROL_SELECTOR = [
  'button:has-text("VIEW")',
  'button:has-text("View")',
  'a:has-text("VIEW")',
  'a:has-text("View")',
  'input[type="submit"][value*="VIEW"]',
  'input[type="submit"][value*="View"]',
  'input[type="button"][value*="VIEW"]',
  'input[type="button"][value*="View"]',
].join(', ')

function normalizeNameValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeToken(value?: string): string {
  return normalizeNameValue(value || '').toLowerCase()
}

function parseDonorName(rawName: string): {
  firstName: string
  lastName: string
  middleInitial?: string
} | null {
  const cleaned = normalizeNameValue(rawName)
  if (!cleaned) return null

  // Example from Redwood: "Cebulski, Michael"
  if (cleaned.includes(',')) {
    const [lastRaw, firstRaw] = cleaned.split(',', 2)
    const firstParts = normalizeNameValue(firstRaw || '').split(' ').filter(Boolean)
    if (!lastRaw || firstParts.length === 0) return null

    return {
      firstName: firstParts[0],
      lastName: normalizeNameValue(lastRaw),
      middleInitial: firstParts[1]?.charAt(0),
    }
  }

  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length < 2) return null

  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleInitial: parts.length > 2 ? parts[1].charAt(0) : undefined,
  }
}

function parseDateKey(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const normalized = trimmed
    .replace(/,\s*/g, ' ')
    .replace(/(\d)(AM|PM)/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildImageFileName(client: RedwoodClient, mimeType: string): string {
  const safeFirst = normalizeToken(client.firstName).replace(/\s+/g, '-') || 'client'
  const safeLast = normalizeToken(client.lastName).replace(/\s+/g, '-') || 'headshot'

  let extension = 'jpg'
  if (mimeType.includes('png')) extension = 'png'
  if (mimeType.includes('webp')) extension = 'webp'
  if (mimeType.includes('gif')) extension = 'gif'

  return `redwood-headshot-${safeLast}-${safeFirst}.${extension}`
}

function detectImageMimeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }

  // GIF: GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif'
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

function getDobCellText(cells: string[]): string | undefined {
  return cells.find((cell) => {
    const value = cell.trim()
    if (!value) return false

    const hasYear = /\b(19|20)\d{2}\b/.test(value)
    const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value) || /[a-zA-Z]{3,}\s+\d{1,2}/.test(value)
    return hasYear && hasDatePattern
  })
}

async function submitDonorSearch(page: any): Promise<boolean> {
  const waitForResultsNavigation = async (): Promise<boolean> => {
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    return !/DonorSearch\.aspx/i.test(page.url())
  }

  const exactClicked = await clickFirstVisible(page, [
    '#PageContent_DonorSearchParameterForm1_Search',
    'input[name="ctl00$PageContent$DonorSearchParameterForm1$Search"]',
    'input[id*="DonorSearchParameterForm1_Search"]',
  ])

  if (exactClicked && (await waitForResultsNavigation())) {
    return true
  }

  const nativeClicked = await page
    .evaluate(() => {
      const button = document.getElementById('PageContent_DonorSearchParameterForm1_Search') as HTMLInputElement | null
      if (!button) return false
      button.click()
      return true
    })
    .catch(() => false)

  if (nativeClicked && (await waitForResultsNavigation())) {
    return true
  }

  const postbackSubmitted = await page.evaluate(() => {
    const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
    if (typeof win.__doPostBack !== 'function') return false

    const targets = [
      'ctl00$PageContent$DonorSearchParameterForm1$Search',
      'ctl00$PageContent$DonorSearchParameterForm1$btnSearch',
    ]

    for (const target of targets) {
      try {
        win.__doPostBack(target, '')
        return true
      } catch {
        // Try next target
      }
    }

    return false
  })

  if (postbackSubmitted && (await waitForResultsNavigation())) {
    return true
  }

  const formSubmitted = await page.evaluate(() => {
    const input = document.querySelector('#PageContent_DonorSearchParameterForm1_txtLastName') as HTMLInputElement | null
    const form = input?.form || (document.querySelector('form') as HTMLFormElement | null)
    if (!form) return false
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return true
    }
    form.submit()
    return true
  })

  return formSubmitted && (await waitForResultsNavigation())
}

async function getLoginDiagnostics(page: any): Promise<string> {
  const diagnostics = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 320)
    const hasPassword = !!document.querySelector('input[type="password"]')
    const hasUsername =
      !!document.querySelector('input[name*="UserName"]') ||
      !!document.querySelector('input[id*="UserName"]') ||
      !!document.querySelector('input[type="text"]')

    return {
      url: window.location.href,
      title: document.title,
      bodyText,
      hasPassword,
      hasUsername,
      forms: document.querySelectorAll('form').length,
    }
  })

  return `url="${diagnostics.url}" title="${diagnostics.title}" forms=${diagnostics.forms} hasUsername=${diagnostics.hasUsername} hasPassword=${diagnostics.hasPassword} body="${diagnostics.bodyText}"`
}

function selectBestCandidate(candidates: DonorCandidate[], clientDob?: string): DonorCandidate {
  if (candidates.length === 0) {
    throw new Error('No donor rows returned from Redwood search')
  }

  const clientDobKey = parseDateKey(clientDob)

  if (clientDobKey) {
    const dobMatches = candidates
      .filter((candidate) => candidate.dobKey === clientDobKey)
      .sort((a, b) => b.score - a.score)

    if (dobMatches.length === 0) {
      throw new Error('No DOB-verified Redwood donor match found')
    }

    const top = dobMatches[0]
    const runnerUp = dobMatches[1]
    if (runnerUp && top.score - runnerUp.score <= DONOR_AMBIGUOUS_SCORE_DELTA) {
      throw new Error('Multiple DOB-verified Redwood donor matches are ambiguous')
    }

    return top
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]

  if (top.score < NAME_ONLY_MIN_SCORE) {
    throw new Error('No confident name-only Redwood donor match found')
  }

  const runnerUp = sorted[1]
  if (runnerUp && top.score - runnerUp.score <= DONOR_AMBIGUOUS_SCORE_DELTA) {
    throw new Error('Multiple name-only Redwood donor matches are ambiguous')
  }

  return top
}

async function extractHeadshotImageUrl(page: any): Promise<string> {
  await page.waitForTimeout(500)

  const exactDonorPhoto = page.locator('#PageContent_DonorPhoto').first()
  if ((await exactDonorPhoto.count()) > 0) {
    const src = await exactDonorPhoto.getAttribute('src')
    if (src) {
      return src
    }
  }

  const prioritizedSelectors = [
    'img#PageContent_DonorPhoto',
    'img.donor-photo',
    'img[id*="DonorPhoto"]',
    'img[src*="DonorPhoto.aspx"]',
    'img[src*="donorphoto.aspx"]',
  ]

  for (const selector of prioritizedSelectors) {
    const locator = page.locator(selector).first()
    if ((await locator.count()) === 0) continue

    const src = await locator.getAttribute('src')
    if (src) {
      return src
    }
  }

  const fallback = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'))

    const candidates = images.map((img) => {
      const src = img.getAttribute('src') || ''
      const id = img.id || ''
      const cls = img.className || ''
      const alt = img.getAttribute('alt') || ''
      const donorHint = `${src} ${id} ${cls} ${alt}`.toLowerCase()
      const score =
        (donorHint.includes('donorphoto.aspx') ? 4 : 0) +
        (donorHint.includes('donorphoto') ? 2 : 0) +
        (donorHint.includes('donor-photo') ? 1 : 0)

      return {
        src,
        score,
      }
    })
      .filter((candidate) => {
        if (!candidate.src) return false
        return candidate.score > 0
      })
      .sort((a, b) => b.score - a.score)

    return candidates[0]?.src || null
  })

  if (!fallback) {
    const html = await page.content()
    const donorPhotoMatch = html.match(/DonorPhoto\.aspx\?[^"'\\s<)]+/i)
    if (donorPhotoMatch?.[0]) {
      return donorPhotoMatch[0]
    }

    const diagnostic = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
        .slice(0, 12)
        .map((img) => ({
          id: img.id || null,
          src: img.getAttribute('src') || null,
          cls: img.className || null,
        }))
      return {
        url: window.location.href,
        title: document.title,
        imgs,
        body: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      }
    })

    throw new Error(
      `Unable to locate donor headshot image on Redwood donor page (url="${diagnostic.url}", title="${diagnostic.title}", imgs=${JSON.stringify(diagnostic.imgs)}, body="${diagnostic.body}")`,
    )
  }

  return fallback
}

async function readRedwoodDonorMetadata(page: any): Promise<{
  donorId: string | null
  callInCode: string | null
}> {
  return await page.evaluate(() => {
    const donorId = (() => {
      try {
        return new URL(window.location.href).searchParams.get('donorid')?.trim() || null
      } catch {
        return null
      }
    })()

    const bodyLines = (document.body?.innerText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    let callInCode: string | null = null
    for (let index = 0; index < bodyLines.length; index++) {
      const line = bodyLines[index]
      if (!/check-?in code\/pin:/i.test(line)) continue
      const inline = line.split(':')[1]?.trim()
      if (inline) {
        callInCode = inline
        break
      }

      const nextLine = bodyLines[index + 1]?.trim()
      if (nextLine) {
        callInCode = nextLine
        break
      }
    }

    return {
      donorId,
      callInCode,
    }
  })
}

async function readRedwoodDonorEditPhotoState(page: any): Promise<{
  canRemovePhoto: boolean
  photoFlagValue: string | null
}> {
  return await page.evaluate(() => {
    const removeButton = document.getElementById('PageContent_Donor_RemovePhoto') as HTMLInputElement | null
    const photoFlag = document.getElementById('PageContent_Donor_IsDonorPhotExist') as HTMLInputElement | null

    const canRemovePhoto = Boolean(
      removeButton &&
        ((removeButton.offsetWidth || removeButton.offsetHeight || removeButton.getClientRects().length) > 0),
    )

    return {
      canRemovePhoto,
      photoFlagValue: photoFlag?.value?.trim() || null,
    }
  })
}

async function waitForRealDonorPhoto(args: {
  donorId: string | null
  donorSearchUrl: string
  page: any
}): Promise<{
  canRemovePhoto: boolean
  photoFlagValue: string | null
}> {
  const { donorId, donorSearchUrl, page } = args

  if (!donorId) {
    return {
      canRemovePhoto: false,
      photoFlagValue: null,
    }
  }

  let latestState = {
    canRemovePhoto: false,
    photoFlagValue: null as string | null,
  }

  for (let attempt = 0; attempt <= REDWOOD_HEADSHOT_PULL_RETRY_ATTEMPTS; attempt++) {
    await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorId), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)

    latestState = await readRedwoodDonorEditPhotoState(page)
    if (latestState.canRemovePhoto || latestState.photoFlagValue === 'true') {
      return latestState
    }

    if (attempt < REDWOOD_HEADSHOT_PULL_RETRY_ATTEMPTS) {
      await page.waitForTimeout(REDWOOD_HEADSHOT_PULL_RETRY_DELAY_MS)
    }
  }

  return latestState
}

export async function fetchRedwoodHeadshotForClient(client: RedwoodClient): Promise<RedwoodHeadshotScrapeResult> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL

  if (!client.lastName?.trim()) {
    throw new Error('Client last name is required for Redwood donor search')
  }

  const { browser, context, page } = await openRedwoodBrowserContext()

  try {
    await loginToRedwood(page, auth)
    const openClientDonorPage = async (): Promise<{
      matchedDonorName: string
      donorId: string | null
      callInCode: string | null
    }> => {
      if (client.redwoodDonorId?.trim()) {
        await page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, client.redwoodDonorId.trim()), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)

        const donorMetadata = await readRedwoodDonorMetadata(page)
        return {
          matchedDonorName: `${client.lastName}, ${client.firstName}`,
          donorId: donorMetadata.donorId || client.redwoodDonorId.trim(),
          callInCode: donorMetadata.callInCode,
        }
      }

      const directResultsUrl = buildRedwoodDonorSearchResultsUrl({
        donorSearchUrl,
        uniqueId: client.redwoodUniqueId,
        accountNumber: getRedwoodAccountNumber(),
        active: true,
      })

      await page.goto(directResultsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(800)

      const onResultsPage = /DonorSearchResults\.aspx/i.test(page.url())
      if (!onResultsPage) {
        const attemptedUrl = page.url()
        const bodySnippet = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220))
        throw new Error(
          `Donor search did not navigate to results page for unique ID "${client.redwoodUniqueId || ''}". Current URL: "${attemptedUrl}". Body: "${bodySnippet}"`,
        )
      }

      const rows = page.locator('tr').filter({
        has: page.locator(VIEW_CONTROL_SELECTOR),
      })
      const rowCount = await rows.count()

      if (rowCount === 0) {
        throw new Error(`No Redwood donor rows found for unique ID "${client.redwoodUniqueId || ''}"`)
      }

      const candidates: DonorCandidate[] = []
      for (let index = 0; index < rowCount; index++) {
        const row = rows.nth(index)
        const cells = (await row.locator('td').allTextContents()).map((cell) => cell.trim()).filter(Boolean)
        if (cells.length === 0) continue

        const nameCell = cells.find((cell) => cell.includes(',')) || cells[1] || cells[0]
        const parsedName = parseDonorName(nameCell)
        if (!parsedName) continue

        const dobCell = getDobCellText(cells)
        const score = calculateNameSimilarity(
          client.firstName,
          client.lastName,
          parsedName.firstName,
          parsedName.lastName,
          client.middleInitial,
          parsedName.middleInitial,
        )

        candidates.push({
          rowIndex: index,
          fullName: `${parsedName.lastName}, ${parsedName.firstName}`,
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          middleInitial: parsedName.middleInitial,
          dobText: dobCell,
          dobKey: parseDateKey(dobCell) || undefined,
          score,
        })
      }

      const selectedCandidate = selectBestCandidate(candidates, client.dob)
      const selectedRow = rows.nth(selectedCandidate.rowIndex)
      const viewButton = selectedRow.locator(VIEW_CONTROL_SELECTOR).first()

      const viewHref = (await viewButton.getAttribute('href')) || ''
      const postBackMatch = viewHref.match(/__doPostBack\('([^']+)'/)
      const beforeViewUrl = page.url()

      await viewButton.click()

      await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(600)

      const stillOnResultsPage = /DonorSearchResults\.aspx/i.test(page.url()) || page.url() === beforeViewUrl
      if (stillOnResultsPage && postBackMatch?.[1]) {
        const eventTarget = postBackMatch[1]
        await page.evaluate((target) => {
          const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
          if (typeof win.__doPostBack === 'function') {
            win.__doPostBack(target, '')
          }
        }, eventTarget)

        await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(600)
      }

      const donorMetadata = await readRedwoodDonorMetadata(page)
      return {
        matchedDonorName: selectedCandidate.fullName,
        donorId: donorMetadata.donorId,
        callInCode: donorMetadata.callInCode,
      }
    }

    // If we were redirected back to login, auth failed.
    if (/login\.aspx/i.test(page.url())) {
      const loginErrorText = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        const normalized = text.replace(/\s+/g, ' ').trim()
        const hints = ['invalid', 'incorrect', 'locked', 'expired', 'disabled', 'unable']
        if (!normalized) return null
        if (hints.some((hint) => normalized.toLowerCase().includes(hint))) {
          return normalized.slice(0, 240)
        }
        return null
      })

      const details = loginErrorText ? ` Redwood says: "${loginErrorText}"` : ''
      const diagnosticDetails = await getLoginDiagnostics(page)
      throw new Error(
        `Redwood login failed. Verify REDWOOD_USERNAME/REDWOOD_PASSWORD and restart dev server after .env changes.${details} Diagnostics: ${diagnosticDetails}`,
      )
    }

    const donorContext = await openClientDonorPage()

    await page
      .waitForSelector('#PageContent_DonorPhoto, img.donor-photo, img[src*="DonorPhoto.aspx"]', {
        timeout: 8000,
      })
      .catch(() => {})

    const photoState = await waitForRealDonorPhoto({
      donorId: donorContext.donorId || extractRedwoodDonorIdFromUrl(page.url()),
      donorSearchUrl,
      page,
    })

    if (!photoState.canRemovePhoto && photoState.photoFlagValue !== 'true') {
      throw new Error(`Redwood donor ${donorContext.matchedDonorName} does not have a real headshot to sync yet.`)
    }

    await page.goto(
      buildRedwoodDonorViewUrl(
        donorSearchUrl,
        donorContext.donorId || extractRedwoodDonorIdFromUrl(page.url()) || '',
      ),
      { waitUntil: 'domcontentloaded', timeout: 30000 },
    )
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)

    const headshotSrc = await extractHeadshotImageUrl(page)
    const headshotUrl = new URL(headshotSrc, page.url()).toString()
    const response = await context.request.get(headshotUrl, { timeout: 30000 })

    if (!response.ok()) {
      throw new Error(`Failed to download Redwood headshot image (HTTP ${response.status()})`)
    }

    const imageBuffer = Buffer.from(await response.body())
    if (imageBuffer.length === 0) {
      throw new Error('Downloaded Redwood headshot image was empty')
    }

    const headerMime = (response.headers()['content-type'] || '').split(';')[0].trim().toLowerCase()
    const sniffedMime = detectImageMimeFromBuffer(imageBuffer)
    const mimeType = headerMime.startsWith('image/') ? headerMime : sniffedMime

    if (!mimeType) {
      const bodyPrefix = imageBuffer.toString('utf8', 0, 120).replace(/\s+/g, ' ').trim()
      throw new Error(
        `Redwood headshot download was not an image (header content-type="${headerMime || 'unknown'}"). Body prefix: "${bodyPrefix}"`,
      )
    }

    return {
      imageBuffer,
      mimeType,
      fileName: buildImageFileName(client, mimeType),
      matchedDonorName: donorContext.matchedDonorName,
      donorId: donorContext.donorId || extractRedwoodDonorIdFromUrl(page.url()) || undefined,
      callInCode: donorContext.callInCode,
    }
  } finally {
    await browser.close()
  }
}
