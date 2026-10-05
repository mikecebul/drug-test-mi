import { expect, type Locator, type Page } from '@playwright/test'

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

async function hasVisibleValidationMessage(page: Page) {
  return (
    (await page.getByRole('alert').filter({ hasText: /\S/ }).count()) > 0 ||
    (await page.locator('[aria-invalid="true"]:visible').count()) > 0
  )
}

export async function openWizard(page: Page) {
  await page.goto('/admin/drug-test-upload', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-wizard-ready="true"]')).toBeVisible({ timeout: 30_000 })
}

const directWorkflowRoutes: Record<string, { workflow: string; step: string }> = {
  'Register New Client': { workflow: 'register-client', step: 'personalInfo' },
  'Collect Sample for Lab': { workflow: 'collect-lab', step: 'client' },
  'Enter Lab Screen Data': { workflow: 'enter-lab-screen', step: 'upload' },
  'Enter Lab Confirmation Data': { workflow: 'enter-lab-confirmation', step: 'upload' },
  'Screen Instant Test': { workflow: 'instant-test', step: 'upload' },
}

export async function expectWizardStep(page: Page, step: string) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get('step'), {
      message: `Expected workflow step "${step}"`,
      timeout: 20_000,
    })
    .toBe(step)
  await expect(page.locator('[data-wizard-ready="true"]')).toHaveAttribute('data-wizard-step', step)
}

export async function expectValidationError(page: Page, control?: Locator) {
  if (control) await expect(control).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible()
}

export async function selectWorkflow(page: Page, title: string) {
  const route = directWorkflowRoutes[title]
  if (!route) throw new Error(`Unknown workflow: ${title}`)
  await page.goto(`/admin/drug-test-upload?${new URLSearchParams(route)}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-wizard-ready="true"]')).toBeVisible({ timeout: 30_000 })
  await expectWizardStep(page, route.step)
  await expect(await getNextButton(page)).toBeEnabled({ timeout: 20_000 })
}

export async function clickNext(page: Page) {
  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeVisible({ timeout: 20_000 })
  await expect(nextButton).toBeEnabled({ timeout: 20_000 })
  await nextButton.scrollIntoViewIfNeeded()
  const beforeUrl = page.url()
  const missingHeadshotDialog = page.getByRole('alertdialog', { name: 'Continue without a headshot?' })

  await nextButton.click({ timeout: 10_000 })

  await expect
    .poll(
      async () => {
        if (page.url() !== beforeUrl || (await hasVisibleValidationMessage(page))) {
          return true
        }

        if (
          await page
            .getByRole('alertdialog')
            .isVisible()
            .catch(() => false)
        ) {
          return true
        }

        return false
      },
      {
        message: 'Expected Next to change the wizard step or show a validation error',
        timeout: 20_000,
      },
    )
    .toBe(true)

  if (await missingHeadshotDialog.isVisible().catch(() => false)) {
    await missingHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).click()
  } else if (
    page.url() === beforeUrl &&
    !(await page
      .getByRole('alertdialog')
      .isVisible()
      .catch(() => false))
  ) {
    // An error already on screen must not finish this action while the session
    // check or validation is still running.
    await expect
      .poll(async () => page.url() !== beforeUrl || (await nextButton.isEnabled()), { timeout: 20_000 })
      .toBe(true)
  }
}

export async function triggerNextValidation(page: Page) {
  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeVisible()
  if (await nextButton.isEnabled()) {
    await nextButton.scrollIntoViewIfNeeded()
    try {
      await nextButton.click({ timeout: 4_000 })
    } catch (error) {
      if (!(await nextButton.isDisabled().catch(() => false))) throw error
    }
    // An existing field error can appear before the session check and this
    // submission finish. Wait for the action to settle before editing again.
    await expect(nextButton).toBeEnabled()
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
  const input = page.locator('[data-slot="file-upload"] input[type="file"]').first()
  await expect(input).toBeAttached()
  await expect(page.locator('[data-wizard-ready="true"]')).toBeVisible({ timeout: 30_000 })
  await input.setInputFiles(filePath)
  await expect(page.getByText(filePath.split('/').pop()!, { exact: true }).first()).toBeVisible()
}

export async function selectClientFromSearchDialog(page: Page, fullName: string) {
  const openButton = page.getByRole('button', {
    name: /search all clients|search existing clients|find existing client|choose(?: or register)? client|change client/i,
  })
  const dialog = page.getByRole('dialog', { name: /Search and Select Client|Choose client/i })

  await openButton.click()
  await expect(dialog).toBeVisible()
  const searchInput = dialog.getByRole('combobox')
  const parts = fullName.trim().split(/\s+/)
  const searchTerm = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName
  await searchInput.fill(searchTerm)

  await dialog
    .getByRole('option', { name: nameToLoosePattern(fullName) })
    .first()
    .click()
  await expect(dialog).toBeHidden()
}

async function waitForWizardStep(page: Page, step: string) {
  await expectWizardStep(page, step)
}

async function clickNextToStep(page: Page, step: string) {
  await clickNext(page)
  await waitForWizardStep(page, step)
}

export async function waitForExtractStepReady(page: Page, options?: { timeoutMs?: number }) {
  await expect(page.getByTestId('parsed-report')).toBeVisible({ timeout: options?.timeoutMs ?? 45_000 })
  await expect(page.getByTestId('parsed-report')).toHaveAttribute('data-results-complete', 'true')
}

async function ensureInstantExtractReady(page: Page) {
  await waitForWizardStep(page, 'extract')
  await waitForExtractStepReady(page)
}

// Selecting the client makes the report identity comparison possible. If it
// differs, the workflow returns to review before medication/result decisions.
export async function continueFromInstantClient(page: Page) {
  await clickNext(page)
  if (new URL(page.url()).searchParams.get('step') === 'extract') {
    await ensureInstantExtractReady(page)
    const confirmation = page.getByRole('checkbox', { name: 'This is the same person', exact: true })
    await expect(confirmation).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await confirmation.check()
    await clickNextToStep(page, 'client')
    await clickNextToStep(page, 'medications')
  }
  await expectWizardStep(page, 'medications')
}

async function ensureInstantVerifyDataReady(page: Page) {
  await waitForWizardStep(page, 'verifyData')

  const decisionSection = page.locator('#accept')
  if (await decisionSection.isVisible().catch(() => false)) {
    await selectResultDecision(page, 'accept')
  }

  const nextButton = await getNextButton(page)
  await expect(nextButton).toBeEnabled({ timeout: 15_000 })
}

export async function selectResultDecision(
  page: Page,
  decision: 'accept' | 'request-confirmation' | 'pending-decision',
) {
  const control = page.locator(`#${decision}`)
  await expect(control).toBeVisible()
  if (!(await control.isChecked())) await control.click()
  await expect(control).toBeChecked()
}

export async function goToInstantResults(page: Page, pdfPath: string, clientName: string) {
  await waitForWizardStep(page, 'upload')
  await uploadSinglePdf(page, pdfPath)
  await clickNextToStep(page, 'extract')
  await ensureInstantExtractReady(page)
  await clickNextToStep(page, 'client')

  await selectClientFromSearchDialog(page, clientName)
  await continueFromInstantClient(page)
  await clickNextToStep(page, 'verifyData')
}

export async function goToEmailsStepFromInstant(page: Page, pdfPath: string, clientName: string) {
  await goToInstantResults(page, pdfPath, clientName)
  await ensureInstantVerifyDataReady(page)
  await clickNextToStep(page, 'reviewEmails')
}

export async function goToLabScreenData(page: Page, pdfPath: string, testId: string) {
  await uploadSinglePdf(page, pdfPath)
  await clickNextToStep(page, 'extract')
  await waitForExtractStepReady(page)
  await clickNextToStep(page, 'matchCollection')
  const candidate = page.getByTestId(`pending-test-${testId}`)
  await candidate.focus()
  await candidate.press('Space')
  await expect(candidate).toHaveAttribute('aria-pressed', 'true')
  await clickNextToStep(page, 'labScreenData')
}

export async function extractTestIdFromSuccess(page: Page): Promise<string> {
  const button = page.getByTestId('wizard-view-drug-test-button')
  await expect(button).toBeVisible({ timeout: 30_000 })
  const id = await button.getAttribute('data-drug-test-id')
  if (!id) throw new Error('The completed collection must identify the saved test record')
  return id
}
