import { calculateNameSimilarity } from '@/views/PDFUploadWizard/utils/calculateSimilarity'

const DEFAULT_REDWOOD_LOGIN_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/Public/Login.aspx'
const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const DONOR_AMBIGUOUS_SCORE_DELTA = 0.02
const NAME_ONLY_MIN_SCORE = 0.85

interface RedwoodClient {
  firstName: string
  lastName: string
  middleInitial?: string
  dob?: string
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
}

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

function normalizeEnvCredential(rawValue: string | undefined): {
  value: string
  hadWrappingQuotes: boolean
} {
  if (typeof rawValue !== 'string') {
    return { value: '', hadWrappingQuotes: false }
  }

  const trimmed = rawValue.trim()
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"')
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'")

  if (hasDoubleQuotes || hasSingleQuotes) {
    return {
      value: trimmed.slice(1, -1),
      hadWrappingQuotes: true,
    }
  }

  return { value: trimmed, hadWrappingQuotes: false }
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

async function fillFirstVisibleInput(page: any, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count === 0) continue

    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i)
      try {
        if (!(await candidate.isVisible())) continue
        await candidate.click({ timeout: 2000 })
        // Type via keyboard to trigger legacy key handlers on older ASP.NET pages.
        await candidate.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {})
        await candidate.press('Backspace').catch(() => {})
        await candidate.type(value, { delay: 25 })
        return true
      } catch {
        // Try next candidate
      }
    }
  }

  return false
}

async function clickFirstVisible(page: any, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count === 0) continue

    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i)
      try {
        if (!(await candidate.isVisible())) continue
        await candidate.click()
        return true
      } catch {
        // Try next candidate
      }
    }
  }

  return false
}

async function submitLoginFormFallback(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const passwordField =
      (document.querySelector('input[type="password"]') as HTMLInputElement | null) ||
      (document.querySelector('input[name*="Password"]') as HTMLInputElement | null) ||
      (document.querySelector('input[id*="Password"]') as HTMLInputElement | null)

    if (!passwordField) return false

    const form = passwordField.form || (document.querySelector('form') as HTMLFormElement | null)
    if (!form) return false

    // Prefer requestSubmit to emulate a user submit event.
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return true
    }

    form.submit()
    return true
  })
}

async function submitWithAspNetPostBack(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
    if (typeof win.__doPostBack !== 'function') return false

    const targets = [
      'ctl00$PageContent$Login1$LoginButtonMembership',
      'ctl00$PageContent$Login1$LoginButton',
      'ctl00$PageContent$Login1$LoginImageButton',
      'PageContent$Login1$LoginButton',
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
}

async function submitDonorSearch(page: any): Promise<boolean> {
  const exactClicked = await clickFirstVisible(page, [
    '#PageContent_DonorSearchParameterForm1_Search',
    'input[name="ctl00$PageContent$DonorSearchParameterForm1$Search"]',
    'input[id*="DonorSearchParameterForm1_Search"]',
  ])
  if (exactClicked) return true

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

  if (postbackSubmitted) return true

  return await page.evaluate(() => {
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

export async function fetchRedwoodHeadshotForClient(client: RedwoodClient): Promise<RedwoodHeadshotScrapeResult> {
  const normalizedUsername = normalizeEnvCredential(process.env.REDWOOD_USERNAME)
  const normalizedPassword = normalizeEnvCredential(process.env.REDWOOD_PASSWORD)
  const username = normalizedUsername.value
  const password = normalizedPassword.value
  const loginUrl = process.env.REDWOOD_LOGIN_URL?.trim() || DEFAULT_REDWOOD_LOGIN_URL
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL

  if (!username) {
    throw new Error('Missing required environment variable: REDWOOD_USERNAME')
  }

  if (!password.trim()) {
    throw new Error('Missing required environment variable: REDWOOD_PASSWORD')
  }

  if (!client.lastName?.trim()) {
    throw new Error('Client last name is required for Redwood donor search')
  }

  let playwright: any
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error('Playwright is not installed. Run `pnpm install` to install project dependencies.')
  }
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const usernameFilled = await fillFirstVisibleInput(
      page,
      [
        '#PageContent_Login1_UserName',
        'input[name="ctl00$PageContent$Login1$UserName"]',
        'input[name*="UserName"]',
        'input[id*="UserName"]',
        'input[placeholder*="User"]',
        'input[type="text"]',
      ],
      username,
    )

    if (!usernameFilled) {
      throw new Error('Unable to find Redwood username field')
    }

    const passwordFilled = await fillFirstVisibleInput(
      page,
      [
        '#PageContent_Login1_Password',
        'input[name="ctl00$PageContent$Login1$Password"]',
        'input[name*="Password"]',
        'input[id*="Password"]',
        'input[type="password"]',
      ],
      password,
    )

    if (!passwordFilled) {
      throw new Error('Unable to find Redwood password field')
    }

    const clickedLogin = await clickFirstVisible(page, [
      '#PageContent_Login1_LoginButtonMembership',
      'input[name="ctl00$PageContent$Login1$LoginButtonMembership"]',
      '#PageContent_Login1_LoginButton',
      'input[name="ctl00$PageContent$Login1$LoginButton"]',
      'button:has-text("LOGIN")',
      'button:has-text("Login")',
      'input[id*="Login"]',
      'input[id*="login"]',
      'input[name*="Login"]',
      'input[name*="login"]',
      'input[type="submit"][value*="LOGIN"]',
      'input[type="submit"][value*="Login"]',
      'input[type="button"][value*="LOGIN"]',
      'input[type="button"][value*="Login"]',
      'a:has-text("LOGIN")',
      'a:has-text("Login")',
      'button[type="submit"]',
      '[role="button"]:has-text("LOGIN")',
      '[role="button"]:has-text("Login")',
    ])

    // Some Abbott login pages have broken JS assets in automation contexts.
    // Always attempt direct form submit so we don't rely on onclick handlers.
    const submittedByForm = await submitLoginFormFallback(page)
    let loginSubmitAttempted = submittedByForm

    if (!loginSubmitAttempted) {
      const submittedWithPostBack = await submitWithAspNetPostBack(page)
      loginSubmitAttempted = submittedWithPostBack
    }

    if (!loginSubmitAttempted && clickedLogin) {
      loginSubmitAttempted = true
    }

    if (!loginSubmitAttempted) {
      // Final fallback for forms that submit on Enter only.
      const submittedWithEnter = await (async () => {
        for (const selector of ['input[name*="Password"]', 'input[id*="Password"]', 'input[type="password"]']) {
          const locator = page.locator(selector)
          const count = await locator.count()
          for (let i = 0; i < count; i++) {
            const field = locator.nth(i)
            try {
              if (!(await field.isVisible())) continue
              await field.press('Enter')
              return true
            } catch {
              // Try next password field
            }
          }
        }
        return false
      })()

      if (!submittedWithEnter) {
        const diagnostic = await page.evaluate(() => {
          const formCount = document.querySelectorAll('form').length
          const submitControlCount = document.querySelectorAll(
            'button, input[type="submit"], input[type="button"], [role="button"], a',
          ).length
          return { formCount, submitControlCount, title: document.title, url: window.location.href }
        })

        throw new Error(
          `Unable to submit Redwood login form (forms=${diagnostic.formCount}, controls=${diagnostic.submitControlCount}, title="${diagnostic.title}", url="${diagnostic.url}")`,
        )
      }
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    // Give ASP.NET postback-based auth time to finalize session cookie before direct navigation.
    await page.waitForTimeout(1200)
    await page.goto(donorSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

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
        `Redwood login failed. Verify REDWOOD_USERNAME/REDWOOD_PASSWORD and restart dev server after .env changes.${details} Diagnostics: ${diagnosticDetails} usernameLength=${username.length} passwordLength=${password.length} usernameQuoted=${normalizedUsername.hadWrappingQuotes} passwordQuoted=${normalizedPassword.hadWrappingQuotes}`,
      )
    }

    const searchLastName = normalizeNameValue(client.lastName)
    const lastNameFilled = await fillFirstVisibleInput(
      page,
      [
        '#PageContent_DonorSearchParameterForm1_txtLastName',
        'input[name="ctl00$PageContent$DonorSearchParameterForm1$txtLastName"]',
        'input[name*="LastName"]',
        'input[id*="LastName"]',
        'input[aria-label*="Last Name"]',
      ],
      searchLastName,
    )

    if (!lastNameFilled) {
      throw new Error('Unable to find Redwood donor last-name search field')
    }

    const searchSubmitted = await submitDonorSearch(page)

    if (!searchSubmitted) {
      throw new Error('Unable to find Redwood donor search button')
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)

    const onResultsPage = /DonorSearchResults\.aspx/i.test(page.url())
    if (!onResultsPage) {
      const attemptedUrl = page.url()
      const bodySnippet = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220))
      throw new Error(
        `Donor search did not navigate to results page for last name "${searchLastName}". Current URL: "${attemptedUrl}". Body: "${bodySnippet}"`,
      )
    }

    const rows = page.locator('tr').filter({
      has: page.locator(VIEW_CONTROL_SELECTOR),
    })
    const rowCount = await rows.count()

    if (rowCount === 0) {
      throw new Error(`No Redwood donor rows found for last name "${searchLastName}"`)
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

    // Use the real UI action first.
    await viewButton.click()

    await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(600)

    // If we're still on results, try explicit ASP.NET postback fallback.
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

    await page
      .waitForSelector('#PageContent_DonorPhoto, img.donor-photo, img[src*="DonorPhoto.aspx"]', {
        timeout: 8000,
      })
      .catch(() => {})

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
      matchedDonorName: selectedCandidate.fullName,
    }
  } finally {
    await browser.close()
  }
}
