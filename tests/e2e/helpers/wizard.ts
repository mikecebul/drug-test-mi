import { expect, type Page } from '@playwright/test'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nameToLoosePattern(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    return new RegExp(escapeRegex(fullName), 'i')
  }

  const firstName = escapeRegex(parts[0])
  const lastName = escapeRegex(parts[parts.length - 1])
  return new RegExp(`${firstName}\\s+.*${lastName}`, 'i')
}

async function getNextButton(page: Page) {
  const byTestId = page.getByTestId('wizard-next-button').first()
  if ((await byTestId.count()) > 0) {
    return byTestId
  }
  return page.getByRole('button', { name: /^next$/i })
}

async function getBackButton(page: Page) {
  const byTestId = page.getByTestId('wizard-back-button').first()
  if ((await byTestId.count()) > 0) {
    return byTestId
  }
  return page.getByRole('button', { name: /^back$/i })
}

async function waitForWizardHome(page: Page) {
  const indicators = [
    page.getByText('Drug Test Workflow'),
    page.getByText('Select the type of workflow you want to perform'),
    page.getByText('Register New Client'),
  ]

  const end = Date.now() + 30_000
  while (Date.now() < end) {
    for (const locator of indicators) {
      if (await locator.first().isVisible().catch(() => false)) {
        return
      }
    }
    await page.waitForTimeout(250)
  }

  throw new Error('Timed out waiting for wizard workflow chooser.')
}

export async function openWizard(page: Page) {
  const alreadyOnWizard = page.url().includes('/admin/drug-test-upload')
  if (alreadyOnWizard) {
    const hasWizardUI =
      (await page.getByText('Select the type of workflow you want to perform').first().isVisible().catch(() => false)) ||
      (await page.getByTestId('wizard-next-button').first().isVisible().catch(() => false)) ||
      (await page.getByText('Drug Test Workflow').first().isVisible().catch(() => false))

    if (hasWizardUI) {
      return
    }
  }

  await page.goto('/admin/drug-test-upload', { waitUntil: 'domcontentloaded' })
  await waitForWizardHome(page)
}

const directWorkflowRoutes: Record<string, { workflow: string; step: string }> = {
  'Register New Client': { workflow: 'register-client', step: 'personalInfo' },
  'Collect Sample for Lab': { workflow: 'collect-lab', step: 'client' },
  'Enter Lab Screen Data': { workflow: 'enter-lab-screen', step: 'upload' },
  'Enter Lab Confirmation Data': { workflow: 'enter-lab-confirmation', step: 'upload' },
  'Screen 15-Panel Instant': { workflow: '15-panel-instant', step: 'upload' },
}

async function waitForWorkflowLoaded(page: Page) {
  const end = Date.now() + 20_000
  while (Date.now() < end) {
    const nextVisible = await page.getByTestId('wizard-next-button').first().isVisible().catch(() => false)
    if (nextVisible) {
      return
    }

    const stillOnHome = await page
      .getByText('Select the type of workflow you want to perform')
      .first()
      .isVisible()
      .catch(() => false)

    if (!stillOnHome) {
      return
    }

    await page.waitForTimeout(150)
  }
}

export async function selectWorkflow(page: Page, title: string) {
  const directRoute = directWorkflowRoutes[title]
  if (directRoute) {
    const params = new URLSearchParams({
      workflow: directRoute.workflow,
      step: directRoute.step,
    })

    await page.goto(`/admin/drug-test-upload?${params.toString()}`, { waitUntil: 'domcontentloaded' })
    await waitForWorkflowLoaded(page)

    const stillOnHome = await page
      .getByText('Select the type of workflow you want to perform')
      .first()
      .isVisible()
      .catch(() => false)
    if (!stillOnHome) {
      return
    }
  }

  const titlePattern = new RegExp(`^${escapeRegex(title)}$`, 'i')

  for (let attempt = 0; attempt < 3; attempt++) {
    const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: titlePattern }).first()
    if ((await card.count()) > 0) {
      await card.click({ force: true })
    } else {
      const heading = page.getByRole('heading', { name: titlePattern }).first()
      const headingCard = heading.locator('xpath=ancestor::*[contains(@class, "cursor-pointer")][1]')
      if ((await headingCard.count()) > 0) {
        await headingCard.click({ force: true })
      } else {
        await heading.click({ force: true })
      }
    }

    await page.waitForTimeout(250)
    const stillOnHome = await page
      .getByText('Select the type of workflow you want to perform')
      .first()
      .isVisible()
      .catch(() => false)
    if (!stillOnHome) {
      return
    }
  }

  throw new Error(`Unable to select workflow card: "${title}"`)
}

export async function clickNext(page: Page) {
  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeVisible({ timeout: 20_000 })
  await expect(nextButton).toBeEnabled({ timeout: 20_000 })
  await nextButton.scrollIntoViewIfNeeded()
  await nextButton.click({ timeout: 10_000 })
}

export async function triggerNextValidation(page: Page) {
  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeVisible()
  if (await nextButton.isEnabled()) {
    await nextButton.scrollIntoViewIfNeeded()
    try {
      await nextButton.click({ timeout: 4_000 })
    } catch (error) {
      if (await nextButton.isDisabled().catch(() => false)) {
        return
      }
      throw error
    }
  }
}

export async function expectNextDisabled(page: Page) {
  await expect(await getNextButton(page)).toBeDisabled()
}

export async function clickBack(page: Page) {
  const backButton = await getBackButton(page)
  await expect(backButton).toBeVisible()
  await expect(backButton).toBeEnabled()
  await backButton.click({ timeout: 10_000 })
}

export async function uploadSinglePdf(page: Page, filePath: string) {
  const uploadRoots = page.locator('[data-slot="file-upload"]')
  const rootCount = await uploadRoots.count()

  for (let i = 0; i < rootCount; i += 1) {
    const root = uploadRoots.nth(i)
    const visibleDropzone = await root.locator('[data-slot="file-upload-dropzone"]').first().isVisible().catch(() => false)
    if (!visibleDropzone) {
      continue
    }

    const input = root.locator('input[type="file"]').first()
    await input.setInputFiles(filePath)
    return
  }

  const fallbackInput = page.locator('input[type="file"]').first()
  await expect(fallbackInput).toBeAttached({ timeout: 10_000 })
  await fallbackInput.setInputFiles(filePath)
}

export async function selectClientFromSearchDialog(page: Page, fullName: string) {
  await page.getByRole('button', { name: /search all clients|change client/i }).click()

  const dialog = page.getByRole('dialog', { name: /Search and Select Client/i })
  await expect(dialog).toBeVisible()

  const searchInput = dialog.getByPlaceholder('Search by name, DOB, phone, or email...')
  await expect(searchInput).toBeVisible()
  const parts = fullName.trim().split(/\s+/)
  const searchTerm = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName
  await searchInput.fill(searchTerm)

  const clientMatchPattern = nameToLoosePattern(fullName)
  const clientByText = dialog.getByText(clientMatchPattern).first()
  const failedFetch = dialog.getByText('Failed to fetch')

  const end = Date.now() + 20_000
  while (Date.now() < end) {
    if (await failedFetch.isVisible().catch(() => false)) {
      throw new Error(`Client search failed while selecting "${fullName}".`)
    }

    if (await clientByText.isVisible().catch(() => false)) {
      await clientByText.click()
      return
    }

    await page.waitForTimeout(250)
  }

  await dialog.getByRole('option', { name: clientMatchPattern }).first().click()
}

type InstantStep = 'upload' | 'extract' | 'client' | 'medications' | 'verifyData' | 'confirm' | 'reviewEmails'

async function waitForWizardStep(page: Page, step: InstantStep, timeoutMs = 20_000) {
  await expect
    .poll(
      () => {
        const current = new URL(page.url()).searchParams.get('step')
        return current ?? ''
      },
      { timeout: timeoutMs, message: `Timed out waiting for wizard step "${step}"` },
    )
    .toBe(step)
}

async function clickNextToStep(page: Page, step: InstantStep) {
  await clickNext(page)
  await waitForWizardStep(page, step)
}

export async function waitForExtractStepReady(
  page: Page,
  options?: {
    readyHeadings?: Array<string | RegExp>
    timeoutMs?: number
  },
) {
  const readyHeadings = options?.readyHeadings ?? [/Extract Data/i, /Data Extracted/i, /Confirmation Data Extracted/i]
  const timeoutMs = options?.timeoutMs ?? 25_000
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const loading = await page.getByText('Extracting Data...').first().isVisible().catch(() => false)
    if (loading) {
      await page.waitForTimeout(200)
      continue
    }

    const hasReadyHeading = await Promise.all(
      readyHeadings.map(async (heading) => {
        if (heading instanceof RegExp) {
          return page.getByText(heading).first().isVisible().catch(() => false)
        }
        return page.getByText(heading, { exact: false }).first().isVisible().catch(() => false)
      }),
    ).then((states) => states.some(Boolean))

    if (!hasReadyHeading) {
      await page.waitForTimeout(200)
      continue
    }

    const nextButton = await getNextButton(page)
    if (await nextButton.isEnabled().catch(() => false)) {
      return
    }

    await page.waitForTimeout(200)
  }

  throw new Error('Extract step did not become ready to advance.')
}

async function ensureInstantExtractReady(page: Page) {
  await waitForWizardStep(page, 'extract')
  await waitForExtractStepReady(page, {
    readyHeadings: [/Extract Data/i],
  })
}

async function ensureInstantVerifyDataReady(page: Page) {
  await waitForWizardStep(page, 'verifyData')

  const decisionSection = page.getByText('Confirmation Decision Required').first()
  if (await decisionSection.isVisible().catch(() => false)) {
    const acceptResults = page.getByRole('radio', { name: /Accept Results/i }).first()
    await acceptResults.check()
  }

  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeEnabled({ timeout: 15_000 })
}

export async function goToEmailsStepFromInstant(page: Page, pdfPath: string, clientName?: string) {
  await waitForWizardStep(page, 'upload')
  await uploadSinglePdf(page, pdfPath)
  await clickNextToStep(page, 'extract')
  await ensureInstantExtractReady(page)
  await clickNextToStep(page, 'client')

  if (clientName) {
    const hasSelectedClient = await page.getByRole('heading', { name: /Selected Client/i }).isVisible().catch(() => false)
    if (!hasSelectedClient) {
      await selectClientFromSearchDialog(page, clientName)
    }
  }

  await clickNextToStep(page, 'medications')
  await clickNextToStep(page, 'verifyData')
  await ensureInstantVerifyDataReady(page)
  await clickNextToStep(page, 'confirm')
  await clickNextToStep(page, 'reviewEmails')
}

export async function extractTestIdFromSuccess(page: Page): Promise<string> {
  const viewButtonWithId = page.getByTestId('wizard-view-drug-test-button').first()
  if (await viewButtonWithId.isVisible().catch(() => false)) {
    const testId = await viewButtonWithId.getAttribute('data-drug-test-id')
    if (testId) {
      return testId
    }
  }

  const link = page.locator('a[href*="/admin/collections/drug-tests/"]').first()
  if (await link.isVisible().catch(() => false)) {
    const href = await link.getAttribute('href')
    const match = href?.match(/\/admin\/collections\/drug-tests\/([^/?#]+)/)
    if (!match) {
      throw new Error(`Unable to extract test id from success URL: ${href}`)
    }
    return match[1]
  }

  const viewButton = page.getByRole('button', { name: /View Drug Test/i }).first()
  await expect(viewButton).toBeVisible({ timeout: 20_000 })
  await viewButton.click({ force: true })
  await page.waitForURL(/\/admin\/collections\/drug-tests\/[^/?#]+/i, { timeout: 20_000 })

  const currentUrl = page.url()
  const urlMatch = currentUrl.match(/\/admin\/collections\/drug-tests\/([^/?#]+)/i)
  if (!urlMatch) {
    throw new Error(`Unable to extract test id from browser URL: ${currentUrl}`)
  }

  return urlMatch[1]
}
