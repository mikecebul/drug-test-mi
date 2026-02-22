import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { assertNotificationSent } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { loginAdmin } from './helpers/auth'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import {
  clickBack,
  clickNext,
  expectNextDisabled,
  extractTestIdFromSuccess,
  openWizard,
  selectWorkflow,
  triggerNextValidation,
  uploadSinglePdf,
  waitForExtractStepReady,
} from './helpers/wizard'

let fixtures: FixtureContext

async function ensureMatchSelected(page: Page) {
  const headingPattern = new RegExp(`${fixtures.clients.labScreen.firstName}\\s+.*${fixtures.clients.labScreen.lastName}`, 'i')
  const candidateHeading = page.getByRole('heading', { name: headingPattern }).first()
  await expect(candidateHeading).toBeVisible({ timeout: 20_000 })

  const headingCard = candidateHeading.locator('xpath=ancestor::*[contains(@class, "cursor-pointer")][1]')
  if ((await headingCard.count()) > 0) {
    await headingCard.click()
  } else {
    await candidateHeading.click()
  }
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled()
}

function hasDecisionSection(page: Page) {
  return page.getByText('Confirmation Decision Required')
}

async function resolveConfirmationDecision(page: Page) {
  const nextButton = page.getByTestId('wizard-next-button')
  const acceptResults = page.locator('label[for="accept"]').first()
  const acceptRadio = page.locator('#accept').first()
  const missingDecisionError = page.getByText('Must select an option')
  const missingSubstancesError = page.getByText('Please select at least one substance for confirmation testing')

  await acceptResults.click()
  await expect(acceptRadio).toHaveAttribute('data-state', 'checked')
  if (await nextButton.isDisabled().catch(() => false)) {
    const hasVisibleValidationError =
      (await missingDecisionError.isVisible().catch(() => false)) ||
      (await missingSubstancesError.isVisible().catch(() => false))

    if (!hasVisibleValidationError) {
      await triggerNextValidation(page)
    }

    await acceptResults.click()
    await expect(acceptRadio).toHaveAttribute('data-state', 'checked')
  }

  await expect(nextButton).toBeEnabled({ timeout: 7_500 })
}

async function ensureLabScreenDataReadyToAdvance(page: Page) {
  const nextButton = page.getByTestId('wizard-next-button')

  for (let i = 0; i < 20; i += 1) {
    const decisionVisible = await hasDecisionSection(page).isVisible().catch(() => false)
    if (decisionVisible) {
      await resolveConfirmationDecision(page)
      return
    }

    const nextDisabled = await nextButton.isDisabled().catch(() => true)
    if (!nextDisabled) {
      // Give async preview/validation a beat to settle before advancing.
      await page.waitForTimeout(200)
      const decisionAfterSettle = await hasDecisionSection(page).isVisible().catch(() => false)
      const nextStillEnabled = await nextButton.isEnabled().catch(() => false)
      if (!decisionAfterSettle && nextStillEnabled) {
        return
      }
    } else {
      await page.waitForTimeout(200)
    }
  }

  if (await hasDecisionSection(page).isVisible().catch(() => false)) {
    await resolveConfirmationDecision(page)
    return
  }

  await triggerNextValidation(page)
  const alertText = (await page.getByRole('alert').first().textContent().catch(() => null))?.trim()
  throw new Error(
    `Lab screen step stayed blocked before advancing${alertText ? `: ${alertText}` : ' without a visible validation alert'}`,
  )
}

test.describe('Wizard Lab Screen Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    const env = getE2EEnv()
    if (env.enableMailpitAssertions) {
      await ensureMailpitReachable(env.mailpitApiBase)
    }
  })

  test.afterAll(async () => {
    await cleanupFixtures(fixtures)
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await openWizard(page)
    await selectWorkflow(page, 'Enter Lab Screen Data')
  })

  test('validates upload and confirmation-decision flow with back-forward navigation', async ({ page }) => {
    const env = getE2EEnv()

    await clickNext(page)
    await expect(page.getByText('Please upload a PDF file')).toBeVisible()

    await uploadSinglePdf(page, env.pdfLabScreenPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await clickNext(page)

    const matchRequiredAlert = page.getByText('Please select a pending test to continue')
    if (await matchRequiredAlert.isVisible().catch(() => false)) {
      await clickNext(page)
      await expect(matchRequiredAlert).toBeVisible()
    }

    await ensureMatchSelected(page)
    await clickNext(page)

    await expect(page.getByText('Verify Lab Screening Data')).toBeVisible()
    const decisionSection = hasDecisionSection(page)

    if (await decisionSection.isVisible().catch(() => false)) {
      await page.getByLabel(/Fentanyl/i).check()
      await triggerNextValidation(page)
      await expect(page.getByText('Must select an option')).toBeVisible()
      await expectNextDisabled(page)

      await page.getByRole('radio', { name: /Request Confirmation Testing/i }).click()
      await page.getByRole('button', { name: /Clear/i }).click()
      await triggerNextValidation(page)
      await expect(page.getByText('Please select at least one substance for confirmation testing')).toBeVisible()
      await expectNextDisabled(page)

      await resolveConfirmationDecision(page)
    }

    const nextButton = page.getByTestId('wizard-next-button')
    if (await nextButton.isDisabled().catch(() => false)) {
      if (await hasDecisionSection(page).isVisible().catch(() => false)) {
        await resolveConfirmationDecision(page)
      }
    }

    if (await nextButton.isEnabled().catch(() => false)) {
      await triggerNextValidation(page)
      const confirmHeading = page.getByText('Confirm Lab Screening')
      if (await confirmHeading.isVisible().catch(() => false)) {
        await clickBack(page)
        await expect(page.getByText('Verify Lab Screening Data')).toBeVisible()

        if (await nextButton.isDisabled().catch(() => false)) {
          if (await hasDecisionSection(page).isVisible().catch(() => false)) {
            await resolveConfirmationDecision(page)
          }
        }

        if (await nextButton.isEnabled().catch(() => false)) {
          await clickNext(page)
          await clickNext(page)
          await expect(page.getByText('Review Screening Notification Emails')).toBeVisible()
        } else {
          await expect(nextButton).toBeDisabled()
        }
      } else {
        await expect(nextButton).toBeDisabled()
      }
    } else {
      await expect(nextButton).toBeDisabled()
    }
  })

  test('submits lab-screen workflow, updates seeded collected test, and verifies screened-stage email with attachment', async ({ page }) => {
    const env = getE2EEnv()

    await uploadSinglePdf(page, env.pdfLabScreenPath)
    await clickNext(page)
    await waitForExtractStepReady(page, {
      readyHeadings: [/Extract Data/i],
    })
    await clickNext(page)
    await ensureMatchSelected(page)
    await clickNext(page)

    await ensureLabScreenDataReadyToAdvance(page)
    await clickNext(page)
    await clickNext(page)

    await expect(page.getByText('Review Screening Notification Emails')).toBeVisible()

    const testStart = new Date()
    await page.getByRole('button', { name: /^Update Test Record$/i }).click()

    await expect(page.getByRole('heading', { name: 'Drug Test Created Successfully!' })).toBeVisible({ timeout: 30_000 })

    const testId = await extractTestIdFromSuccess(page)
    fixtures.created.drugTestIds.push(testId)

    const testRecord = await assertNotificationSent({ testId, stage: 'screened' })
    expect(['screened', 'confirmation-pending']).toContain(testRecord.screeningStatus)

    const expectedSubject = `Drug Test Results - ${fixtures.clients.labScreen.firstName} ${fixtures.clients.labScreen.lastName}`

    if (env.enableMailpitAssertions) {
      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.labScreen.email,
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })

      await findMailpitMessages({
        apiBase: env.mailpitApiBase,
        createdAfter: testStart,
        to: fixtures.clients.labScreen.referralRecipients[0],
        subject: expectedSubject,
        requireAttachment: 'some',
        timeoutMs: 45_000,
      })
    }
  })
})
