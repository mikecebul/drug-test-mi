import { getRedwoodAccountNumber } from '@/lib/redwood/config'
import { buildRedwoodDonorEditUrl, buildRedwoodDonorViewUrl } from '@/lib/redwood/donor-urls'
import {
  normalizeRedwoodNameValue,
  readRedwoodDonorEditPhotoState,
  resolveRedwoodDonorMatch,
} from '@/lib/redwood/donor-search'
import { loginToRedwood, resolveRedwoodAuthEnv, withRedwoodBrowserSession } from '@/lib/redwood/playwright'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const REDWOOD_HEADSHOT_PULL_RETRY_ATTEMPTS = 4
const REDWOOD_HEADSHOT_PULL_RETRY_DELAY_MS = 3000

interface RedwoodClient {
  firstName: string
  lastName: string
  middleInitial?: string
  dob?: string
  redwoodUniqueId?: string
  redwoodDonorId?: string
}

export interface RedwoodHeadshotScrapeResult {
  imageBuffer: Buffer
  mimeType: string
  fileName: string
  matchedDonorName: string
  donorId?: string
  callInCode?: string | null
}

function normalizeToken(value?: string): string {
  return normalizeRedwoodNameValue(value || '').toLowerCase()
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

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif'
  }

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

async function getLoginDiagnostics(page: any): Promise<string> {
  const diagnostics = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 320)
    const hasPassword = !!document.querySelector('input[type="password"]')
    const hasUsername =
      !!document.querySelector('input[name*="UserName"]') ||
      !!document.querySelector('input[id*="UserName"]') ||
      !!document.querySelector('input[type="text"]')

    return {
      bodyText,
      forms: document.querySelectorAll('form').length,
      hasPassword,
      hasUsername,
      title: document.title,
      url: window.location.href,
    }
  })

  return `url="${diagnostics.url}" title="${diagnostics.title}" forms=${diagnostics.forms} hasUsername=${diagnostics.hasUsername} hasPassword=${diagnostics.hasPassword} body="${diagnostics.bodyText}"`
}

async function extractHeadshotImageUrl(page: any): Promise<string> {
  await page.waitForTimeout(500)

  const exactDonorPhoto = page.locator('#PageContent_DonorPhoto').first()
  if ((await exactDonorPhoto.count()) > 0) {
    const src = await exactDonorPhoto.getAttribute('src')
    if (src) return src
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
    if (src) return src
  }

  const fallback = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'))

    const candidates = images
      .map((img) => {
        const src = img.getAttribute('src') || ''
        const id = img.id || ''
        const cls = img.className || ''
        const alt = img.getAttribute('alt') || ''
        const donorHint = `${src} ${id} ${cls} ${alt}`.toLowerCase()
        const score =
          (donorHint.includes('donorphoto.aspx') ? 4 : 0) +
          (donorHint.includes('donorphoto') ? 2 : 0) +
          (donorHint.includes('donor-photo') ? 1 : 0)

        return { score, src }
      })
      .filter((candidate) => candidate.src && candidate.score > 0)
      .sort((a, b) => b.score - a.score)

    return candidates[0]?.src || null
  })

  if (fallback) return fallback

  const html = await page.content()
  const donorPhotoMatch = html.match(/DonorPhoto\.aspx\?[^"'\\s<)]+/i)
  if (donorPhotoMatch?.[0]) {
    return donorPhotoMatch[0]
  }

  const diagnostic = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
      .slice(0, 12)
      .map((img) => ({
        cls: img.className || null,
        id: img.id || null,
        src: img.getAttribute('src') || null,
      }))

    return {
      body: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      imgs,
      title: document.title,
      url: window.location.href,
    }
  })

  throw new Error(
    `Unable to locate donor headshot image on Redwood donor page (url="${diagnostic.url}", title="${diagnostic.title}", imgs=${JSON.stringify(diagnostic.imgs)}, body="${diagnostic.body}")`,
  )
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

  return withRedwoodBrowserSession(
    {
      runtimeProfile: 'job',
    },
    async ({ context, page }) => {
      await loginToRedwood(page, auth)

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

      const donorContext = await resolveRedwoodDonorMatch({
        accountNumber: getRedwoodAccountNumber(),
        client,
        donorSearchUrl,
        page,
      })

      await page
        .waitForSelector('#PageContent_DonorPhoto, img.donor-photo, img[src*="DonorPhoto.aspx"]', {
          timeout: 8000,
        })
        .catch(() => {})

      const photoState = await waitForRealDonorPhoto({
        donorId: donorContext.donorId,
        donorSearchUrl,
        page,
      })

      if (!photoState.canRemovePhoto && photoState.photoFlagValue !== 'true') {
        throw new Error(`Redwood donor ${donorContext.matchedDonorName} does not have a real headshot to sync yet.`)
      }

      if (!donorContext.donorId) {
        throw new Error(`Unable to resolve Redwood donor ID for ${donorContext.matchedDonorName}.`)
      }

      await page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, donorContext.donorId), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
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
        donorId: donorContext.donorId || undefined,
        callInCode: donorContext.callInCode,
      }
    },
  )
}
