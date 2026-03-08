import { promises as fs } from 'fs'
import path from 'path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { fetchDocument, type FetchDocumentResult } from '@/collections/DrugTests/services/documentFetch'
import { buildRedwoodDonorEditUrl, buildRedwoodDonorViewUrl } from '@/lib/redwood/donor-urls'
import {
  captureRedwoodDiagnostic,
  readRedwoodDonorEditPhotoState,
  readRedwoodDonorMetadata,
  resolveRedwoodDonorMatch,
  type RedwoodDonorLookupClient,
} from '@/lib/redwood/donor-search'
import { formatDateForRedwood, mapGenderToRedwoodSex, normalizePhoneForRedwood } from '@/lib/redwood/client-fields'
import type { RedwoodClientUpdateField } from '@/lib/redwood/queue'
import {
  dismissCookieBanner,
  fillFirstVisibleInput,
  loginToRedwood,
  resolveRedwoodAuthEnv,
  waitForAnyVisible,
  withRedwoodBrowserSession,
  clickFirstVisible,
} from '@/lib/redwood/playwright'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

function buildUploadFileName(clientId: string, fileName: string): string {
  const parsed = path.parse(fileName)
  const normalizedBase = (parsed.name || 'headshot')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const safeBase = normalizedBase || 'headshot'
  return `${clientId}-${safeBase}${parsed.ext || '.jpg'}`
}

async function writeRedwoodHeadshotUploadFile(args: {
  clientId: string
  headshot: FetchDocumentResult
}): Promise<string> {
  const { clientId, headshot } = args
  const uploadsDir = path.join(process.cwd(), 'output', 'redwood', 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })

  const normalizedMime = headshot.mimeType.trim().toLowerCase()
  const canUploadAsIs = normalizedMime === 'image/jpeg' || normalizedMime === 'image/png' || normalizedMime === 'image/gif'

  if (canUploadAsIs) {
    const tempPath = path.join(uploadsDir, buildUploadFileName(clientId, headshot.filename))
    await fs.writeFile(tempPath, headshot.buffer)
    return tempPath
  }

  const convertedPath = path.join(uploadsDir, `${clientId}-headshot.jpg`)
  await sharp(headshot.buffer).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toFile(convertedPath)
  return convertedPath
}

async function readDonorSaveResult(page: any): Promise<{
  bodyText: string
  hasSavedElement: boolean
  hasSavedMessage: boolean
  onDonorViewPage: boolean
}> {
  return await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    const savedElement = document.getElementById('PageContent_pDonorSaved')

    return {
      bodyText,
      hasSavedElement: Boolean(savedElement?.textContent?.trim()),
      hasSavedMessage: /donor information saved successfully/i.test(bodyText),
      onDonorViewPage: /\/pages\/user\/donor\.aspx/i.test(window.location.pathname),
    }
  })
}

type RedwoodUpdateControlKind = 'select' | 'text'

type RedwoodUpdatePlanEntry = {
  expectedValue: string
  field: RedwoodClientUpdateField
  fragments: string[]
  kind: RedwoodUpdateControlKind
  acceptedSelectValues?: string[]
}

function buildFieldLookupSelectors(fragments: string[], tagNames: string[]): string[] {
  return fragments.flatMap((fragment) =>
    tagNames.flatMap((tagName) => [
      `${tagName}[id*="${fragment}"]`,
      `${tagName}[name*="${fragment}"]`,
      `${tagName}[aria-label*="${fragment}"]`,
      `${tagName}[placeholder*="${fragment}"]`,
    ]),
  )
}

async function setVisibleInputValueByFragments(page: any, fragments: string[], value: string): Promise<boolean> {
  const selectorMatch = await fillFirstVisibleInput(page, buildFieldLookupSelectors(fragments, ['input', 'textarea']), value)
  if (selectorMatch) {
    return true
  }

  return await page.evaluate(
    ({ rawFragments, rawValue }) => {
      const fragments = rawFragments.map((fragment) => fragment.toLowerCase())
      const matches = (element: Element): boolean => {
        const htmlElement = element as HTMLElement
        if (!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)) {
          return false
        }

        if (element instanceof HTMLInputElement && element.type === 'hidden') {
          return false
        }

        const labelText =
          element.closest('label')?.textContent ||
          (element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent : '') ||
          ''
        const haystack = [
          element.getAttribute('id') || '',
          element.getAttribute('name') || '',
          element.getAttribute('aria-label') || '',
          element.getAttribute('placeholder') || '',
          labelText,
        ]
          .join(' ')
          .toLowerCase()

        return fragments.some((fragment) => haystack.includes(fragment))
      }

      const controls = Array.from(document.querySelectorAll('input, textarea')).filter(
        (element): element is HTMLInputElement | HTMLTextAreaElement => matches(element),
      )

      const control = controls[0]
      if (!control) return false

      const prototype =
        control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
      descriptor?.set?.call(control, rawValue)
      if (!descriptor?.set) {
        control.value = rawValue
      }
      control.dispatchEvent(new Event('input', { bubbles: true }))
      control.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    { rawFragments: fragments, rawValue: value },
  )
}

async function setVisibleSelectValueByFragments(
  page: any,
  fragments: string[],
  acceptedValues: string[],
): Promise<boolean> {
  return await page.evaluate(
    ({ rawAcceptedValues, rawFragments }) => {
      const fragments = rawFragments.map((fragment) => fragment.toLowerCase())
      const acceptedValues = rawAcceptedValues.map((value) => value.trim().toLowerCase())
      const matches = (element: HTMLSelectElement): boolean => {
        const htmlElement = element as HTMLElement
        if (!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)) {
          return false
        }

        const labelText =
          element.closest('label')?.textContent ||
          (element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent : '') ||
          ''
        const haystack = [
          element.getAttribute('id') || '',
          element.getAttribute('name') || '',
          element.getAttribute('aria-label') || '',
          labelText,
        ]
          .join(' ')
          .toLowerCase()

        return fragments.some((fragment) => haystack.includes(fragment))
      }

      const controls = Array.from(document.querySelectorAll('select')).filter(
        (element): element is HTMLSelectElement => matches(element),
      )

      const control = controls[0]
      if (!control) return false

      const options = Array.from(control.options)
      const option = options.find((candidate) => {
        const optionValue = candidate.value.trim().toLowerCase()
        const optionLabel = candidate.text.trim().toLowerCase()
        return acceptedValues.includes(optionValue) || acceptedValues.includes(optionLabel)
      })

      if (!option) return false

      control.value = option.value
      control.dispatchEvent(new Event('input', { bubbles: true }))
      control.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    { rawAcceptedValues: acceptedValues, rawFragments: fragments },
  )
}

async function readVisibleControlValueByFragments(
  page: any,
  fragments: string[],
  kind: RedwoodUpdateControlKind,
): Promise<string | null> {
  return await page.evaluate(
    ({ rawFragments, rawKind }) => {
      const fragments = rawFragments.map((fragment) => fragment.toLowerCase())
      const controls = Array.from(document.querySelectorAll(rawKind === 'select' ? 'select' : 'input, textarea'))

      for (const element of controls) {
        const htmlElement = element as HTMLElement
        if (!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)) {
          continue
        }

        if (element instanceof HTMLInputElement && element.type === 'hidden') {
          continue
        }

        const labelText =
          element.closest('label')?.textContent ||
          (element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent : '') ||
          ''
        const haystack = [
          element.getAttribute('id') || '',
          element.getAttribute('name') || '',
          element.getAttribute('aria-label') || '',
          element.getAttribute('placeholder') || '',
          labelText,
        ]
          .join(' ')
          .toLowerCase()

        if (!fragments.some((fragment) => haystack.includes(fragment))) {
          continue
        }

        if (element instanceof HTMLSelectElement) {
          return element.selectedOptions[0]?.value?.trim() || element.value.trim() || null
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          return element.value.trim() || null
        }
      }

      return null
    },
    { rawFragments: fragments, rawKind: kind },
  )
}

function normalizeComparableRedwoodValue(field: RedwoodClientUpdateField, value: string | null | undefined): string {
  const normalized = (value || '').trim()

  if (field === 'dob') {
    if (!normalized) return ''
    try {
      return formatDateForRedwood(normalized)
    } catch {
      return normalized
    }
  }

  if (field === 'phone') {
    return normalizePhoneForRedwood(normalized)
  }

  if (field === 'gender') {
    const lowered = normalized.toLowerCase()
    if (['m', 'male'].includes(lowered)) return 'm'
    if (['f', 'female'].includes(lowered)) return 'f'
    return lowered
  }

  return normalized
}

function buildRedwoodClientUpdatePlan(args: {
  client: RedwoodDonorLookupClient & {
    gender?: string | null
    phone?: string | null
  }
  changedFields: RedwoodClientUpdateField[]
}): RedwoodUpdatePlanEntry[] {
  const { changedFields, client } = args

  const plan: RedwoodUpdatePlanEntry[] = []

  for (const field of changedFields) {
    switch (field) {
      case 'firstName':
        plan.push({
          field,
          kind: 'text',
          fragments: ['FirstName', 'First Name', 'First'],
          expectedValue: client.firstName.trim(),
        })
        break
      case 'middleInitial':
        plan.push({
          field,
          kind: 'text',
          fragments: ['MiddleInitial', 'Middle Initial', 'Middle', 'MI'],
          expectedValue: client.middleInitial?.trim() || '',
        })
        break
      case 'lastName':
        plan.push({
          field,
          kind: 'text',
          fragments: ['LastName', 'Last Name', 'Last'],
          expectedValue: client.lastName.trim(),
        })
        break
      case 'dob':
        plan.push({
          field,
          kind: 'text',
          fragments: ['DateOfBirth', 'Date of Birth', 'Birth', 'DOB'],
          expectedValue: client.dob ? formatDateForRedwood(client.dob) : '',
        })
        break
      case 'gender': {
        const sexValue = mapGenderToRedwoodSex(client.gender)
        plan.push({
          field,
          kind: 'select',
          fragments: ['Sex', 'Gender'],
          expectedValue: sexValue,
          acceptedSelectValues: sexValue ? [sexValue, sexValue === 'M' ? 'Male' : 'Female'] : ['', 'Select', '-- Select --'],
        })
        break
      }
      case 'phone':
        plan.push({
          field,
          kind: 'text',
          fragments: ['PhoneNumber', 'Phone Number', 'Phone', 'HomePhone'],
          expectedValue: normalizePhoneForRedwood(client.phone),
        })
        break
      default:
        break
    }
  }

  return plan
}


async function enterEditMode(page: any): Promise<void> {
  const uniqueIdInputs = [
    '#PageContent_txtUniqueID',
    'input[name*="UniqueID"]',
    'input[name*="UniqueId"]',
    'input[id*="UniqueID"]',
    'input[id*="UniqueId"]',
  ]

  if (await waitForAnyVisible(page, uniqueIdInputs, 1000)) {
    return
  }

  await clickFirstVisible(page, [
    '#PageContent_btnEdit',
    'input[id*="Edit"]',
    'input[name*="Edit"]',
    'input[type="submit"][value*="Edit"]',
    'button:has-text("Edit")',
    'a:has-text("Edit")',
  ])

  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function saveDonorRecord(page: any): Promise<void> {
  const saveSelectors = [
    '#PageContent_Donor_btnsave',
    '#PageContent_btnSave',
    'input[id*="btnsave"]',
    'input[name*="btnsave"]',
    'input[id*="Save"]',
    'input[name*="Save"]',
    'input[type="submit"][value*="Save"]',
    'button:has-text("Save")',
    'a:has-text("Save")',
  ]

  const nativeSaveClicked = await page
    .evaluate((selectors: string[]) => {
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const htmlElement = element as HTMLElement
          const isVisible = !!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)
          if (!isVisible) continue
          htmlElement.click()
          return true
        }
      }

      return false
    }, saveSelectors)
    .catch(() => false)

  const saveClicked = nativeSaveClicked || (await clickFirstVisible(page, saveSelectors))

  if (!saveClicked) {
    throw new Error('Unable to find a Redwood donor save control')
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

async function collectUniqueIdValues(page: any): Promise<string[]> {
  return await page.evaluate(() => {
    const selectors = [
      '#PageContent_txtUniqueID',
      'input[name*="UniqueID"]',
      'input[name*="UniqueId"]',
      'input[id*="UniqueID"]',
      'input[id*="UniqueId"]',
      '#PageContent_lblUniqueID',
      '[id*="UniqueID"]',
    ]

    const values = new Set<string>()

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const value = element.value.trim()
          if (value) values.add(value)
          continue
        }

        const text = element.textContent?.trim()
        if (text) values.add(text)
      }
    }

    return Array.from(values)
  })
}

async function readDonorDefaultTestSelectionState(page: any): Promise<{
  availableCodes: string[]
  listingText: string | null
  selectedCodes: string[]
}> {
  return await page.evaluate(() => {
    const hiddenSelectedTests = document.getElementById(
      'PageContent_Donor_DefaultTestsPanel_testSelectionGridView_hiddenSelectedTests',
    ) as HTMLInputElement | null

    const dt = (window as unknown as {
      ToxAccess?: {
        DataTables?: Record<string, { fnSettings?: () => any }>
      }
    }).ToxAccess?.DataTables?.tblPageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection

    const settings = typeof dt?.fnSettings === 'function' ? dt.fnSettings() : null
    const availableCodes = Array.isArray(settings?.aoData)
      ? settings.aoData
          .map((row: any) => {
            const rowMarkup = String(row?._aData || '')
            const hiddenMatch = rowMarkup.match(/hiddenTestCode[^>]*value="([^"]+)"/i)
            if (hiddenMatch?.[1]) return hiddenMatch[1].trim()
            const rowText = row?.nTr?.textContent?.replace(/\s+/g, ' ').trim() || ''
            const cellMatch = rowText.match(/([A-Z0-9]{2,10})\s*$/)
            return cellMatch?.[1] || null
          })
          .filter((code: string | null): code is string => Boolean(code))
      : []

    return {
      availableCodes,
      listingText:
        document
          .getElementById('PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection_wrapper')
          ?.textContent?.replace(/\s+/g, ' ')
          .match(/Listing\s+\d+\s*-\s*\d+\s+of\s+\d+/i)?.[0] || null,
      selectedCodes: (hiddenSelectedTests?.value || '')
        .split('||')
        .map((value) => value.trim())
        .filter(Boolean),
    }
  })
}

async function selectDonorDefaultTestCode(page: any, targetCode: string): Promise<{
  availableCodes: string[]
  currentPage: number
  pageCount: number
  selectedCodes: string[]
}> {
  const selection = await page.evaluate((rawTargetCode: string) => {
    const targetCode = rawTargetCode.trim().toUpperCase()
    const hiddenSelectedTests = document.getElementById(
      'PageContent_Donor_DefaultTestsPanel_testSelectionGridView_hiddenSelectedTests',
    ) as HTMLInputElement | null

    const dt = (window as unknown as {
      ToxAccess?: {
        DataTables?: Record<
          string,
          {
            fnSettings?: () => any
            fnPageChange?: (page: number) => void
            selectedTests?: string[]
          }
        >
      }
    }).ToxAccess?.DataTables?.tblPageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection

    const settings = typeof dt?.fnSettings === 'function' ? dt.fnSettings() : null
    if (!hiddenSelectedTests || !dt || !settings || !Array.isArray(settings.aoData)) {
      return { status: 'error' as const, message: 'Redwood donor default tests grid is not initialized.' }
    }

    const availableCodes = settings.aoData
      .map((row: any) => {
        const rowMarkup = String(row?._aData || '')
        const hiddenMatch = rowMarkup.match(/hiddenTestCode[^>]*value="([^"]+)"/i)
        if (hiddenMatch?.[1]) return hiddenMatch[1].trim().toUpperCase()
        const rowText = row?.nTr?.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cellMatch = rowText.match(/([A-Z0-9]{2,10})\s*$/)
        return cellMatch?.[1]?.toUpperCase() || null
      })
      .filter((code: string | null): code is string => Boolean(code))

    const rowIndex = availableCodes.findIndex((code: string) => code === targetCode)
    if (rowIndex < 0) {
      return {
        status: 'missing' as const,
        availableCodes,
      }
    }

    const displayLength = Number(settings._iDisplayLength || 20)
    const currentPage = Math.floor(rowIndex / displayLength)

    const selectedCodes = (hiddenSelectedTests.value || '')
      .split('||')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)

    if (!selectedCodes.includes(targetCode)) {
      selectedCodes.push(targetCode)
    }

    hiddenSelectedTests.value = selectedCodes.join('||')
    dt.selectedTests = selectedCodes

    if (typeof dt.fnPageChange === 'function') {
      dt.fnPageChange(currentPage)
    }

    return {
      status: 'selected' as const,
      availableCodes,
      currentPage,
      pageCount: Math.max(1, Math.ceil(availableCodes.length / displayLength)),
      selectedCodes,
    }
  }, targetCode)

  if (selection.status === 'error') {
    throw new Error(selection.message)
  }

  if (selection.status === 'missing') {
    throw new Error(
      `Redwood donor default-test code "${targetCode}" was not found. Available codes: ${selection.availableCodes.join(', ')}`,
    )
  }

  await page.waitForTimeout(500)

  await page.evaluate((selectedCodes: string[]) => {
    const selectedCodeSet = new Set(selectedCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))
    const rows = Array.from(
      document.querySelectorAll('#PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection tbody tr'),
    )

    for (const row of rows) {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      const hidden = row.querySelector('input[id*="hiddenTestCode"]') as HTMLInputElement | null
      const rowCode =
        hidden?.value?.trim().toUpperCase() ||
        row.querySelector('td:nth-child(3)')?.textContent?.replace(/\s+/g, ' ').trim().toUpperCase() ||
        ''

      if (checkbox) {
        checkbox.checked = selectedCodeSet.has(rowCode)
      }
    }
  }, selection.selectedCodes)

  return {
    availableCodes: selection.availableCodes,
    currentPage: selection.currentPage,
    pageCount: selection.pageCount,
    selectedCodes: selection.selectedCodes,
  }
}

async function resolveRedwoodEnv() {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL

  return { ...auth, donorSearchUrl }
}

export async function updateRedwoodClientDetails(args: {
  client: RedwoodDonorLookupClient & {
    gender?: string | null
    id: string
    phone?: string | null
  }
  accountNumber: string
  changedFields: RedwoodClientUpdateField[]
}): Promise<{
  callInCode: string | null
  donorId: string | null
  screenshotPath: string
  updatedFields: RedwoodClientUpdateField[]
}> {
  const { accountNumber, changedFields, client } = args
  const plan = buildRedwoodClientUpdatePlan({ client, changedFields })
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()

  if (plan.length === 0) {
    throw new Error('No Redwood donor fields were eligible for update.')
  }

  return withRedwoodBrowserSession(
    {
      acceptDownloads: true,
      runtimeProfile: 'job',
    },
    async ({ page }) => {
      try {
        await loginToRedwood(page, { loginUrl, username, password })

        const donorMatch = await resolveRedwoodDonorMatch({
          accountNumber,
          client,
          donorSearchUrl,
          page,
        })

        if (!donorMatch.donorId) {
          throw new Error('Unable to resolve Redwood donor ID for client update.')
        }

        await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)
        await dismissCookieBanner(page)
        await enterEditMode(page)

        const missingFields: RedwoodClientUpdateField[] = []

        for (const entry of plan) {
          const applied =
            entry.kind === 'select'
              ? await setVisibleSelectValueByFragments(page, entry.fragments, entry.acceptedSelectValues || [])
              : await setVisibleInputValueByFragments(page, entry.fragments, entry.expectedValue)

          if (!applied) {
            missingFields.push(entry.field)
          }
        }

        if (missingFields.length > 0) {
          const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-client-update-missing-fields-${client.id}`)
          throw new Error(
            `Unable to locate Redwood donor fields for update: ${Array.from(new Set(missingFields)).join(', ')}. Screenshot: ${screenshotPath}`,
          )
        }

        await saveDonorRecord(page)

        const saveResult = await readDonorSaveResult(page)
        if (!saveResult.onDonorViewPage || (!saveResult.hasSavedElement && !saveResult.hasSavedMessage)) {
          const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-client-update-save-failed-${client.id}`)
          throw new Error(`Redwood donor update did not complete successfully. Screenshot: ${screenshotPath}`)
        }

        await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)

        const verificationFailures: RedwoodClientUpdateField[] = []
        for (const entry of plan) {
          const persistedValue = await readVisibleControlValueByFragments(page, entry.fragments, entry.kind)
          if (
            normalizeComparableRedwoodValue(entry.field, persistedValue) !==
            normalizeComparableRedwoodValue(entry.field, entry.expectedValue)
          ) {
            verificationFailures.push(entry.field)
          }
        }

        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-client-update-saved-${client.id}`)
        if (verificationFailures.length > 0) {
          throw new Error(
            `Redwood donor update could not be verified for: ${Array.from(new Set(verificationFailures)).join(', ')}. Screenshot: ${screenshotPath}`,
          )
        }

        await page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, donorMatch.donorId), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)

        const donorMetadata = await readRedwoodDonorMetadata(page)

        return {
          callInCode: donorMetadata.callInCode,
          donorId: donorMetadata.donorId || donorMatch.donorId,
          screenshotPath,
          updatedFields: changedFields,
        }
      } catch (error) {
        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-client-update-error-${client.id}`).catch(() => null)
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
      }
    },
  )
}

export async function backfillRedwoodClientUniqueId(args: {
  payload: Payload
  client: {
    id: string
    firstName: string
    lastName: string
    middleInitial?: string | null
    dob?: string | null
    redwoodUniqueId?: string | null
  }
  accountNumber: string
}) {
  const { client, accountNumber } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  const donorLookupClient: RedwoodDonorLookupClient = {
    firstName: client.firstName,
    lastName: client.lastName,
    ...(client.middleInitial ? { middleInitial: client.middleInitial } : {}),
    ...(client.dob ? { dob: client.dob } : {}),
    ...(client.redwoodUniqueId ? { redwoodUniqueId: client.redwoodUniqueId } : {}),
  }

  return withRedwoodBrowserSession(
    {
      acceptDownloads: true,
      runtimeProfile: 'job',
    },
    async ({ page }) => {
      try {
        await loginToRedwood(page, { loginUrl, username, password })
        const donorMatch = await resolveRedwoodDonorMatch({
          accountNumber,
          client: donorLookupClient,
          donorSearchUrl,
          page,
        })

        await dismissCookieBanner(page)
        await enterEditMode(page)

        const uniqueId = client.redwoodUniqueId?.trim()
        if (!uniqueId) {
          throw new Error('Client is missing redwoodUniqueId')
        }

        const uniqueIdFilled = await fillFirstVisibleInput(
          page,
          [
            '#PageContent_txtUniqueID',
            'input[name*="UniqueID"]',
            'input[name*="UniqueId"]',
            'input[id*="UniqueID"]',
            'input[id*="UniqueId"]',
          ],
          uniqueId,
        )

        if (!uniqueIdFilled) {
          const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-unique-id-input-missing-${client.id}`)
          throw new Error(`Unable to find Redwood donor Unique ID field. Screenshot: ${screenshotPath}`)
        }

        await saveDonorRecord(page)

        const persistedUniqueIdTexts = await collectUniqueIdValues(page)
        const persistedMatch = persistedUniqueIdTexts.some((text) => text.includes(uniqueId))
        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-unique-id-saved-${client.id}`)

        if (!persistedMatch) {
          throw new Error(`Redwood donor Unique ID could not be verified after save. Screenshot: ${screenshotPath}`)
        }

        return {
          status: 'synced' as const,
          screenshotPath,
          matchedDonor: donorMatch.matchedDonorName,
          donorId: donorMatch.donorId,
        }
      } catch (error) {
        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-unique-id-error-${client.id}`).catch(() => null)
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
      }
    },
  )
}

export async function uploadClientHeadshotToRedwood(args: {
  client: {
    id: string
    firstName: string
    lastName: string
    redwoodUniqueId?: string
    redwoodDonorId?: string
    headshotId: string
  }
  payload: Payload
  accountNumber: string
}) {
  const { client, payload, accountNumber } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  const headshot = await fetchDocument(client.headshotId, payload)
  const tempPath = await writeRedwoodHeadshotUploadFile({
    clientId: client.id,
    headshot,
  })
  try {
    return await withRedwoodBrowserSession(
      {
        acceptDownloads: true,
        runtimeProfile: 'job',
      },
      async ({ page }) => {
        try {
          await loginToRedwood(page, { loginUrl, username, password })
          const donorMatch = await resolveRedwoodDonorMatch({
            accountNumber,
            client,
            donorSearchUrl,
            page,
          })

          if (donorMatch.donorId) {
            await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            })
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
            await page.waitForTimeout(800)
          }

          await dismissCookieBanner(page)
          await enterEditMode(page)

          const fileInput = page.locator(
            [
              '#PageContent_fuPhoto',
              '#PageContent_filePhoto',
              'input[type="file"][id*="Photo"]',
              'input[type="file"][name*="Photo"]',
              'input[type="file"][id*="Image"]',
              'input[type="file"][name*="Image"]',
              'input[type="file"]',
            ].join(', '),
          ).first()

          if ((await fileInput.count()) === 0) {
            const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-headshot-input-missing-${client.id}`)
            throw new Error(`Unable to find Redwood donor photo upload field. Screenshot: ${screenshotPath}`)
          }

          await fileInput.setInputFiles(tempPath)
          await page.waitForTimeout(800)

          const stagedScreenshotPath = await captureRedwoodDiagnostic(page, `redwood-headshot-staged-${client.id}`)

          const maybeUploadClicked = await clickFirstVisible(page, [
            '#PageContent_btnUploadPhoto',
            'input[id*="Upload"][id*="Photo"]',
            'input[name*="Upload"][name*="Photo"]',
            'input[type="submit"][value*="Upload"]',
            'button:has-text("Upload")',
          ])

          if (maybeUploadClicked) {
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
            await page.waitForTimeout(800)
          }

          await saveDonorRecord(page)

          const saveResult = await readDonorSaveResult(page)

          if (!saveResult.onDonorViewPage || (!saveResult.hasSavedElement && !saveResult.hasSavedMessage)) {
            const savedScreenshotPath = await captureRedwoodDiagnostic(page, `redwood-headshot-saved-${client.id}`)
            throw new Error(
              `Redwood donor headshot upload did not complete successfully. Staged screenshot: ${stagedScreenshotPath}. Saved screenshot: ${savedScreenshotPath}`,
            )
          }

          if (donorMatch.donorId) {
            await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            })
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
            await page.waitForTimeout(800)
          }

          const editPhotoState = await readRedwoodDonorEditPhotoState(page)
          const savedScreenshotPath = await captureRedwoodDiagnostic(page, `redwood-headshot-saved-${client.id}`)

          if (!editPhotoState.canRemovePhoto && editPhotoState.photoFlagValue !== 'true') {
            throw new Error(
              `Redwood donor headshot could not be verified on the donor edit page after save. Staged screenshot: ${stagedScreenshotPath}. Saved screenshot: ${savedScreenshotPath}`,
            )
          }

          if (donorMatch.donorId) {
            await page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, donorMatch.donorId), {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            })
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
            await page.waitForTimeout(800)
          }

          const donorMetadata = await readRedwoodDonorMetadata(page)

          return {
            status: 'synced' as const,
            screenshotPath: savedScreenshotPath,
            donorId: donorMetadata.donorId || donorMatch.donorId,
            callInCode: donorMetadata.callInCode,
          }
        } catch (error) {
          const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-headshot-error-${client.id}`).catch(() => null)
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
        }
      },
    )
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
}

export async function syncClientDefaultLabTestInRedwood(args: {
  client: RedwoodDonorLookupClient & {
    id: string
  }
  payload: Payload
  accountNumber: string
  redwoodLabTestCode: string
}): Promise<{
  status: 'synced'
  screenshotPath: string
  donorId: string | null
  selectedCode: string
}> {
  const { client, payload, accountNumber, redwoodLabTestCode } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  return withRedwoodBrowserSession(
    {
      acceptDownloads: true,
      runtimeProfile: 'job',
    },
    async ({ page }) => {
      try {
        await loginToRedwood(page, { loginUrl, username, password })

        const donorMatch = await resolveRedwoodDonorMatch({
          accountNumber,
          client,
          donorSearchUrl,
          page,
        })

        if (!donorMatch.donorId) {
          throw new Error('Unable to resolve Redwood donor ID for default-test sync.')
        }

        await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)
        await dismissCookieBanner(page)
        await enterEditMode(page)

        const panelState = await readDonorDefaultTestSelectionState(page)
        if (panelState.availableCodes.length === 0) {
          throw new Error('Redwood donor default-test grid did not expose any available lab test codes.')
        }

        const existingSelectedCodes = panelState.selectedCodes.map((code) => code.trim().toUpperCase())
        const selectionResult = await selectDonorDefaultTestCode(page, redwoodLabTestCode)
        await saveDonorRecord(page)

        const saveResult = await readDonorSaveResult(page)
        if (!saveResult.onDonorViewPage || (!saveResult.hasSavedElement && !saveResult.hasSavedMessage)) {
          const savedScreenshotPath = await captureRedwoodDiagnostic(page, `redwood-default-test-save-failed-${client.id}`)
          throw new Error(`Redwood donor default-test save did not complete successfully. Screenshot: ${savedScreenshotPath}`)
        }

        await page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorMatch.donorId), {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(800)

        const persistedSelection = await readDonorDefaultTestSelectionState(page)
        const normalizedTargetCode = redwoodLabTestCode.trim().toUpperCase()
        const persisted = persistedSelection.selectedCodes.map((code) => code.toUpperCase())
        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-default-test-saved-${client.id}`)

        const missingPersistedCodes = selectionResult.selectedCodes.filter((code) => !persisted.includes(code))
        const lostExistingCodes = existingSelectedCodes.filter((code) => !persisted.includes(code))

        if (!persisted.includes(normalizedTargetCode) || missingPersistedCodes.length > 0 || lostExistingCodes.length > 0) {
          throw new Error(
            `Redwood donor default-test selection did not persist as expected. Expected to include "${selectionResult.selectedCodes.join(', ')}", received "${persistedSelection.selectedCodes.join(', ')}". Screenshot: ${screenshotPath}`,
          )
        }

        payload.logger.info({
          msg: '[redwood-default-test] Synced Redwood donor default test',
          clientId: client.id,
          donorId: donorMatch.donorId,
          redwoodLabTestCode: normalizedTargetCode,
          screenshotPath,
        })

        return {
          status: 'synced' as const,
          screenshotPath,
          donorId: donorMatch.donorId,
          selectedCode: normalizedTargetCode,
        }
      } catch (error) {
        const screenshotPath = await captureRedwoodDiagnostic(page, `redwood-default-test-error-${client.id}`).catch(() => null)
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
      }
    },
  )
}
