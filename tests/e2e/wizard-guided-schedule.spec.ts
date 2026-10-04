import { devices, expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { getE2EEnv } from './helpers/env'
import { clickNext, selectClientFromSearchDialog, uploadSinglePdf, waitForExtractStepReady } from './helpers/wizard'
import {
  seedFixtures,
  seedGuidedScheduleFixtures,
  type FixtureContext,
  type GuidedScheduleFixtures,
} from './helpers/seed'

let fixtures: FixtureContext
let scheduleFixtures: GuidedScheduleFixtures

function formatScheduleTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function scheduleCardButton(page: Page, attendeeName: string) {
  return page.getByRole('button').filter({ hasText: attendeeName }).first()
}

function scheduleCard(page: Page, attendeeName: string) {
  return scheduleCardButton(page, attendeeName).locator('xpath=..')
}

async function openGuidedSchedule(page: Page) {
  await page.goto('/admin/drug-test-upload?workflow=guided&step=schedule', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Loading appointments...')).toBeHidden({ timeout: 30_000 })
}

async function expectNoHorizontalOverflow(page: Page) {
  try {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
        message: 'The page must fit the viewport',
      })
      .toBeLessThanOrEqual(0)
  } catch (error) {
    console.error(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *'))
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 15)
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            right: element.getBoundingClientRect().right,
            width: element.getBoundingClientRect().width,
          })),
      ),
    )
    throw error
  }
}

async function verifyGuidedClientMismatch(page: Page) {
  const mismatchConfirmation = page.getByRole('checkbox', {
    name: /I verified .* is the person testing today/i,
  })
  await expect(mismatchConfirmation).toBeVisible()
  await mismatchConfirmation.click()
  await expect(page.getByTestId('client-identity-mismatch')).toBeHidden()
}

test.describe("Wizard Today's Schedule", () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
    scheduleFixtures = await seedGuidedScheduleFixtures(fixtures)
    fixtures.created.bookingIds = Array.from(
      new Set([
        ...(fixtures.created.bookingIds || []),
        ...Object.values(scheduleFixtures.bookings).map((booking) => booking.id),
      ]),
    )
  })

  test.afterAll(async () => {
    await cleanupFixtures(fixtures)
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await openGuidedSchedule(page)
  })

  test('shows active and completed bookings in the app-timezone day window', async ({ page }) => {
    const todayCards = page.getByRole('button').filter({ hasText: fixtures.runId })
    await expect(todayCards).toHaveCount(5)

    const paidLinked = scheduleCard(page, scheduleFixtures.bookings.paidLinked.attendeeName)
    await expect(paidLinked).toBeVisible()
    await expect(paidLinked).toContainText(formatScheduleTime(scheduleFixtures.bookings.paidLinked.startTime))
    await expect(paidLinked).toContainText('Male')
    await expect(
      paidLinked.getByText(`${formatScheduleTime(scheduleFixtures.bookings.paidLinked.startTime)} Male`),
    ).toHaveCount(0)
    await expect(paidLinked).toContainText('Pre-paid')

    const unlinked = scheduleCard(page, scheduleFixtures.bookings.unlinked.attendeeName)
    await expect(unlinked).toBeVisible()
    await expect(unlinked).toContainText(formatScheduleTime(scheduleFixtures.bookings.unlinked.startTime))
    await expect(unlinked).toContainText('Unknown')
    await expect(unlinked).toContainText('Still owes')
    await expect(unlinked).toContainText('Register')

    const needsTestType = scheduleCard(page, scheduleFixtures.bookings.needsTestType.attendeeName)
    await expect(needsTestType).toBeVisible()
    await expect(needsTestType).toContainText(formatScheduleTime(scheduleFixtures.bookings.needsTestType.startTime))
    await expect(needsTestType).not.toContainText('Set test')

    const completed = scheduleCard(page, scheduleFixtures.bookings.completedPrepaid.attendeeName)
    await expect(completed).toBeVisible()
    await expect(completed).toContainText('Completed')
    await expect(scheduleCardButton(page, scheduleFixtures.bookings.completedPrepaid.attendeeName)).toBeDisabled()

    await page
      .getByRole('button', {
        name: `${scheduleFixtures.bookings.completedPrepaid.attendeeName} appointment options`,
      })
      .click()
    await page.getByRole('menuitem', { name: 'Cancel and refund' }).click()
    await expect(page.getByRole('menu')).toBeHidden()
    const completedRefundDialog = page.getByRole('dialog', { name: 'Refund completed appointment' })
    await expect(completedRefundDialog).toContainText('collection stays completed')
    await expect(completedRefundDialog.getByLabel('Refund amount')).toHaveValue(/\d+\.\d{2}/)
    await expect(completedRefundDialog.getByRole('button', { name: /Refund payment \$/ })).toBeEnabled()
    await completedRefundDialog.getByRole('button', { name: 'Keep appointment' }).click()

    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.outsideToday.attendeeName }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.cancelledToday.attendeeName }),
    ).toHaveCount(0)
  })

  test('warns before each destructive pending-payment recovery action', async ({ page }) => {
    const attendeeName = `${fixtures.runId} Pending Payment`
    await page.route('**/api/guided-workflow?*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() !== 'GET' || url.searchParams.get('resource') !== 'today-bookings') {
        await route.continue()
        return
      }

      await route.fulfill({
        contentType: 'application/json',
        json: [
          {
            id: 'pending-payment-booking',
            attendeeName,
            attendeeEmail: fixtures.clients.instant.email,
            startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 70 * 60 * 1000).toISOString(),
            calcomBookingId: 'cal-pending-payment',
            calcomPaymentId: 'pi_pending_payment',
            createdViaWebhook: true,
            client: {
              id: fixtures.clients.instant.id,
              firstName: fixtures.clients.instant.firstName,
              lastName: fixtures.clients.instant.lastName,
              email: fixtures.clients.instant.email,
              gender: 'male',
            },
            payment: { amountDue: 35, amountPaid: 0, method: 'card', status: 'unpaid' },
            paymentRecoveryStatus: 'pending',
            canAcceptPendingPayment: true,
            canReschedulePendingPayment: true,
            needsRegistration: false,
            needsTestType: false,
            sampleCollection: null,
            webhookData: { triggerEvent: 'BOOKING_PAYMENT_INITIATED' },
          },
        ],
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Loading appointments...')).toBeHidden({ timeout: 30_000 })

    const pendingCard = scheduleCard(page, attendeeName)
    await expect(pendingCard).toContainText('Payment pending')
    await expect(scheduleCardButton(page, attendeeName)).toBeDisabled()

    const openPendingOptions = async () => {
      await page.getByRole('button', { name: `${attendeeName} pending payment options` }).click()
    }

    await openPendingOptions()
    await page.getByRole('menuitem', { name: 'Accept as unpaid' }).click()
    const acceptDialog = page.getByRole('alertdialog', { name: 'Accept as an unpaid appointment?' })
    await expect(acceptDialog).toContainText('creates a new unpaid appointment')
    await expect(acceptDialog).toContainText('cancels the pending-payment appointment')
    await expect(acceptDialog).toContainText('cancellation and confirmation notifications')
    await acceptDialog.getByRole('button', { name: 'Go back' }).click()

    await openPendingOptions()
    await page.getByRole('menuitem', { name: 'Reschedule as unpaid' }).click()
    const rescheduleDialog = page.getByRole('alertdialog', { name: 'Replace and reschedule this appointment?' })
    await expect(rescheduleDialog).toContainText('If Cal.com is closed')
    await rescheduleDialog.getByRole('button', { name: 'Go back' }).click()

    await openPendingOptions()
    await page.getByRole('menuitem', { name: 'Cancel' }).click()
    const cancelDialog = page.getByRole('alertdialog', { name: 'Cancel pending-payment appointment?' })
    await expect(cancelDialog).toContainText("removes it from today's schedule")
    await cancelDialog.getByRole('button', { name: 'Go back' }).click()

    await page.unrouteAll({ behavior: 'wait' })
  })

  test('chooses or registers a walk-in client from one drawer', async ({ page }) => {
    const walkInCard = page.getByTestId('guided-walk-in-card')
    await expect(walkInCard.getByRole('heading', { name: 'Walk-In Collection' })).toBeVisible()
    await expect(walkInCard.getByText("Add a client without an appointment to today's schedule.")).toBeVisible()
    await expect(walkInCard.getByRole('button', { name: /Choose client/i })).toHaveCount(1)
    await expect(walkInCard.getByRole('button', { name: /Register new client/i })).toHaveCount(0)
    await expect(walkInCard.getByText(/Test type/i)).toHaveCount(0)
    await expect(walkInCard.getByRole('button', { name: /Start/i })).toHaveCount(0)

    await walkInCard.getByRole('button', { name: /Choose client/i }).click()
    const clientDrawer = page.getByRole('dialog', { name: 'Choose client' })
    await expect(clientDrawer).toBeVisible()
    await expect(clientDrawer.getByPlaceholder('Search by name, DOB, phone, or email...')).toBeVisible()
    await expect(clientDrawer.getByRole('button', { name: /Register new client/i })).toBeVisible()

    await clientDrawer.getByRole('button', { name: /Register new client/i }).click()
    await expect(clientDrawer).toBeHidden()
    const registrationDrawer = page.getByRole('dialog', { name: 'Register New Client' })
    await expect(registrationDrawer).toBeVisible()
    await expect(registrationDrawer).toContainText('Step 1 of 5: Personal Info')
    await expect(registrationDrawer.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
    await registrationDrawer.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(registrationDrawer).toBeHidden()

    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    await expect(clientDrawer).toBeHidden()
    await expect(scheduleCard(page, fixtures.clients.instant.fullName)).toBeVisible()
    await expect(walkInCard.getByRole('button', { name: /Choose client/i })).toHaveCount(1)
    await expect(walkInCard).not.toContainText(fixtures.clients.instant.fullName)
  })

  test('keeps schedule, review, and payment usable with iPad touch input', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPad Pro 11'] })
    const page = await context.newPage()

    await loginAdmin(page, fixtures.admin)
    await openGuidedSchedule(page)

    try {
      const walkInCard = page.getByTestId('guided-walk-in-card')
      await expect(walkInCard.getByRole('button', { name: /Choose client/i })).toBeVisible()
      await expectNoHorizontalOverflow(page)

      await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).tap()
      await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Booking Information' })).toBeVisible()
      await expect(page.getByTestId('wizard-next-button')).toBeVisible()
      await expectNoHorizontalOverflow(page)

      await page.getByRole('button', { name: `Edit ${fixtures.clients.instant.fullName}` }).tap()
      const clientEditor = page.getByRole('dialog', { name: 'Edit Client Details' })
      await expect(clientEditor).toBeVisible()
      const saveClientButton = clientEditor.getByRole('button', { name: 'Save Client' })
      await expect(clientEditor.locator('form')).not.toHaveAttribute('data-base-ui-swipe-ignore', '')
      await expect(saveClientButton).toHaveAttribute('data-base-ui-swipe-ignore', 'true')
      await clientEditor.getByLabel('Phone', { exact: true }).fill('2485550199')
      await saveClientButton.tap()
      await expect(clientEditor).toBeHidden({ timeout: 30_000 })
      await expect(page.getByText('Client details updated')).toBeVisible()
      const updatedClient = await page.request.get(`/api/clients/${fixtures.clients.instant.id}?depth=0`, {
        headers: { Origin: new URL(page.url()).origin },
      })
      expect((await updatedClient.json()).phone).toBe('2485550199')

      const mismatchConfirmation = page.getByRole('checkbox', {
        name: /I verified .* is the person testing today/i,
      })
      await mismatchConfirmation.tap()

      const reviewNextButton = page.getByTestId('wizard-next-button')
      await reviewNextButton.tap()
      const noHeadshotDialog = page.getByRole('alertdialog', { name: 'Continue without a headshot?' })
      await expect(noHeadshotDialog).toBeVisible()
      await noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).tap()
      await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
      await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeHidden()
      await page.getByRole('button', { name: 'Add account credit (optional)', exact: true }).tap()
      await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeVisible()
      await expect(page.getByTestId('wizard-next-button')).toBeVisible()
      await expectNoHorizontalOverflow(page)

      const cashMethod = page.getByRole('button', { name: 'Cash payment method' })
      const cardMethod = page.getByRole('button', { name: 'Card payment method' })
      await expect(cashMethod).toHaveAttribute('aria-pressed', 'true')
      await expect(cardMethod).toHaveAttribute('aria-pressed', 'false')
      await cardMethod.tap()
      await expect(cardMethod).toHaveAttribute('aria-pressed', 'true')
      await expect(cashMethod).toHaveAttribute('aria-pressed', 'false')
    } finally {
      await context.close()
    }
  })

  test('keeps schedule actions usable on phones and portrait tablets', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/admin', { waitUntil: 'domcontentloaded' })

      await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible({ timeout: 30_000 })

      const workflowLink = page.getByRole('link', {
        name: `Collect Test for ${scheduleFixtures.bookings.paidLinked.attendeeName}`,
      })
      const scheduleRow = workflowLink.locator('xpath=..')
      await expect(workflowLink).toBeVisible()
      await expect(scheduleRow).toContainText('Pre-paid')
      const optionsButton = page.getByRole('button', {
        name: `${scheduleFixtures.bookings.paidLinked.attendeeName} appointment options`,
      })
      await expect(optionsButton).toBeVisible()
      await optionsButton.click()
      const rescheduleOption = page.getByRole('menuitem', { name: /Reschedule/ })
      const cancelOption = page.getByRole('menuitem', { name: /Cancel/ })
      await expect(rescheduleOption).toBeVisible()
      await expect(rescheduleOption).toHaveAttribute('href', /cal\.com\/reschedule\//)
      await expect(cancelOption).toBeVisible()
      await expect(cancelOption).toHaveAttribute('href', /cal\.com\/booking\//)
      await page.keyboard.press('Escape')

      await expectNoHorizontalOverflow(page)

      await openGuidedSchedule(page)
      await expectNoHorizontalOverflow(page)
    }
  })

  test('opens the correct next step from each schedule card', async ({ page }) => {
    await scheduleCardButton(page, scheduleFixtures.bookings.unlinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await expect(page.getByText('No client profile is linked')).toBeVisible()
    await page.getByRole('button', { name: /Choose or Register Client/i }).click()
    const clientDrawer = page.getByRole('dialog', { name: 'Choose client' })
    await clientDrawer
      .getByPlaceholder('Search by name, DOB, phone, or email...')
      .fill(scheduleFixtures.bookings.unlinked.registeredClient.email)
    await expect(clientDrawer.getByText('Exact matches', { exact: true })).toBeVisible()
    await expect(
      clientDrawer.getByText(scheduleFixtures.bookings.unlinked.registeredClient.fullName, { exact: true }),
    ).toBeVisible()
    await clientDrawer.getByRole('button', { name: 'Close client chooser' }).click()
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCardButton(page, scheduleFixtures.bookings.needsTestType.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    const missingTestNextButton = page.getByTestId('wizard-next-button')
    const editBookingTestButton = page.getByRole('button', { name: 'Edit Booking test' })
    await expect(missingTestNextButton).toBeEnabled()
    await missingTestNextButton.click()
    await expect(editBookingTestButton).toBeFocused()
    await expect(editBookingTestButton).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Choose a test type before continuing.')).toBeVisible()
    await editBookingTestButton.click()
    const testDrawer = page.getByRole('dialog', { name: "Change Today's Test" })
    await expect(testDrawer).toBeVisible()
    await testDrawer.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await expect(page.getByText(fixtures.clients.instant.fullName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(scheduleFixtures.bookings.paidLinked.attendeeName)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: "Booking name doesn't match the client", exact: true }),
    ).toBeVisible()
    await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
    await expect(page.getByText(/DOB/).first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(fixtures.clients.instant.id)
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toHaveCount(0)
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    await expect(page.getByText('No payment needed', { exact: true })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Add account credit (optional)', exact: true })).toBeVisible()
  })

  test('focuses the required identity confirmation without disabling Next', async ({ page }) => {
    await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()

    const identityConfirmation = page.getByRole('checkbox', {
      name: /I verified .* is the person testing today/i,
    })
    const nextButton = page.getByTestId('wizard-next-button')

    await expect(nextButton).toBeEnabled()
    await nextButton.click()
    await expect(identityConfirmation).toBeFocused()
    await expect(identityConfirmation).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Verify the selected client before continuing.')).toBeVisible()

    await identityConfirmation.click()
    await expect(page.getByTestId('client-identity-mismatch')).toBeHidden()
  })

  test('offers a headshot action and warns before continuing without one', async ({ page }) => {
    await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await expect(page.getByTestId('add-headshot-button')).toBeVisible()

    await page.getByRole('button', { name: 'Add headshot' }).click()
    const clientEditor = page.getByRole('dialog', { name: 'Edit Client Details' })
    await expect(clientEditor).toBeVisible()
    await expect(clientEditor.getByRole('button', { name: 'Take Photo' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(clientEditor).toBeHidden({ timeout: 30_000 })

    await verifyGuidedClientMismatch(page)
    const nextButton = page.getByTestId('wizard-next-button')
    await nextButton.click()

    const noHeadshotDialog = page.getByRole('alertdialog', { name: 'Continue without a headshot?' })
    await expect(noHeadshotDialog).toBeVisible()
    await expect(noHeadshotDialog).toContainText('No headshot is on file for this client.')
    await expect(noHeadshotDialog.locator('[data-slot="alert-dialog-media"] svg')).toHaveCount(1)
    await expect(noHeadshotDialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
    await expect(noHeadshotDialog.getByRole('button', { name: 'Capture headshot' })).toBeVisible()

    await noHeadshotDialog.getByRole('button', { name: 'Capture headshot' }).click()
    await expect(noHeadshotDialog).toBeHidden()
    await expect(clientEditor).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(clientEditor).toBeHidden({ timeout: 30_000 })

    await nextButton.click()
    await expect(noHeadshotDialog).toBeVisible()
    await noHeadshotDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(noHeadshotDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()

    await nextButton.click()
    await expect(noHeadshotDialog).toBeVisible()
    await noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
  })

  test('keeps payment navigation responsive while balance details are loading', async ({ page }) => {
    let releaseBalances = () => {}
    const balancesReleased = new Promise<void>((resolve) => {
      releaseBalances = resolve
    })
    let shouldDelayBalances = true

    await page.route('**/api/guided-workflow?*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (
        shouldDelayBalances &&
        request.method() === 'GET' &&
        url.searchParams.get('resource') === 'outstanding-balances'
      ) {
        await balancesReleased
      }
      await route.continue()
    })

    try {
      await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
      await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
      await verifyGuidedClientMismatch(page)

      await page.getByTestId('wizard-next-button').click()
      const noHeadshotDialog = page.getByRole('alertdialog', { name: 'Continue without a headshot?' })
      await expect(noHeadshotDialog).toBeVisible()
      await noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()

      const nextButton = page.getByTestId('wizard-next-button')
      const backButton = page.getByTestId('wizard-back-button')
      await expect(nextButton).toBeDisabled()
      await expect(nextButton).toContainText('Loading payment details...')
      await expect(backButton).toBeEnabled()

      await backButton.click()
      await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    } finally {
      shouldDelayBalances = false
      releaseBalances()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })

  test('keeps controls interactive after repeatedly closing Quick Book', async ({ page }) => {
    const openMenuButton = page.getByRole('button', { name: 'Open menu' }).last()
    if (await openMenuButton.isVisible()) {
      await openMenuButton.click()
      await expect(page.getByRole('button', { name: 'Close menu' }).last()).toBeVisible()
    }

    const quickBookTrigger = page.getByRole('complementary').getByRole('button', { name: 'Quick Book', exact: true })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await quickBookTrigger.click()

      const quickBookDrawer = page.getByRole('dialog', { name: 'Quick Book' })
      await expect(quickBookDrawer).toBeVisible()

      await quickBookDrawer.getByRole('tab', { name: 'New Client' }).click()
      await expect(quickBookDrawer.getByRole('button', { name: 'Book Appointment' })).toBeVisible()
      await quickBookDrawer.getByRole('tab', { name: 'Existing Client' }).click()
      const quickBookSearch = quickBookDrawer.getByLabel('Search Existing Client')
      await expect(quickBookSearch).toBeVisible()

      if (attempt === 0) {
        await quickBookSearch.fill(fixtures.clients.instant.email)
        await expect(quickBookDrawer.getByText('Exact Matches', { exact: true })).toBeVisible()
        await expect(quickBookDrawer.getByText(fixtures.clients.instant.fullName, { exact: true })).toBeVisible()
        await quickBookSearch.fill('')
      }

      await page.keyboard.press('Escape')
      await expect(quickBookDrawer).toBeHidden()
      await expect(quickBookTrigger).toBeFocused()
      await expect
        .poll(() => page.evaluate(() => window.getComputedStyle(document.body).pointerEvents))
        .not.toBe('none')
    }

    await scheduleCardButton(page, scheduleFixtures.bookings.needsTestType.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
  })

  test('applies client credit and can undo the recorded payment', { tag: '@smoke' }, async ({ page }) => {
    const booking = scheduleFixtures.bookings.creditAvailable

    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    await expect(page.locator('dl').filter({ hasText: 'Account credit' }).getByText('$40.00').last()).toBeVisible()
    await expect(page.getByTestId('client-amount-due')).toHaveText('$40.00')
    await page.screenshot({ path: test.info().outputPath('payment-owed.png'), fullPage: true })

    const creditInput = page.getByRole('spinbutton', { name: 'Credit to apply' })
    const amountReceived = page.getByRole('spinbutton', { name: 'Amount received now' })
    await expect(creditInput).toHaveValue('0')
    await expect(amountReceived).toHaveValue('0')

    await page.getByRole('button', { name: 'Apply credit' }).click()
    await expect(creditInput).toHaveValue('40')
    await expect(amountReceived).toHaveValue('0')
    await expect(page.getByTestId('client-amount-due')).toHaveText('$0.00')

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Prepare lab collection' })).toBeVisible()
    await page.getByTestId('wizard-back-button').click()
    await page.getByRole('button', { name: 'Payment breakdown', exact: true }).click()

    const receipt = page.getByTestId('guided-recorded-payment')
    await expect(receipt.getByRole('heading', { name: 'Payment recorded' })).toBeVisible()
    await expect(receipt).toContainText('$40.00 recorded')
    await expect(receipt.getByRole('button', { name: 'Undo payment' })).toBeVisible()

    await receipt.getByRole('button', { name: 'Undo payment' }).click()
    const undoDialog = page.getByRole('alertdialog', { name: 'Undo payment?' })
    await expect(undoDialog).toContainText('restore the applied client credit')
    await expect(undoDialog.locator('[data-slot="alert-dialog-media"] svg')).toHaveCount(1)
    const undoPaymentButton = undoDialog.getByRole('button', { name: 'Undo payment' })
    await expect(undoPaymentButton.locator('svg')).toHaveCount(0)

    let releaseUndoRequest = () => {}
    const undoRequestReleased = new Promise<void>((resolve) => {
      releaseUndoRequest = resolve
    })
    let undoRequestCount = 0
    await page.route('**/api/guided-workflow', async (route) => {
      const request = route.request()
      const body = request.method() === 'POST' ? request.postDataJSON() : null
      if (body?.operation === 'undo-payment') {
        undoRequestCount += 1
        await undoRequestReleased
        await route.abort('connectionfailed')
        return
      }
      await route.continue()
    })

    await undoPaymentButton.click()
    await expect(undoDialog.getByRole('button', { name: 'Undoing...' })).toBeDisabled()
    await expect(undoDialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(undoRequestCount).toBe(1)

    releaseUndoRequest()
    await expect(undoDialog.getByRole('button', { name: 'Undo payment' })).toBeEnabled()
    await expect(undoDialog.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    await expect(undoDialog).toBeVisible()
    await page.unroute('**/api/guided-workflow')

    await undoDialog.getByRole('button', { name: 'Undo payment' }).click()

    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    await expect(page.locator('dl').filter({ hasText: 'Account credit' }).getByText('$40.00').last()).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Credit to apply' })).toHaveValue('0')

    await page.getByTestId('wizard-next-button').click()
    const noPaymentDialog = page.getByRole('alertdialog', { name: 'Continue without payment?' })
    await expect(noPaymentDialog).toContainText('outstanding balance of $40')

    let releaseNoPaymentRequest = () => {}
    const noPaymentRequestReleased = new Promise<void>((resolve) => {
      releaseNoPaymentRequest = resolve
    })
    let noPaymentRequestCount = 0
    await page.route('**/api/guided-workflow', async (route) => {
      const request = route.request()
      const body = request.method() === 'POST' ? request.postDataJSON() : null
      if (body?.operation === 'record-payment') {
        noPaymentRequestCount += 1
        await noPaymentRequestReleased
        await route.abort('connectionfailed')
        return
      }
      await route.continue()
    })

    await noPaymentDialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(noPaymentDialog.getByRole('button', { name: 'Continuing...' })).toBeDisabled()
    await expect(noPaymentDialog.getByRole('button', { name: 'Go back' })).toBeDisabled()
    expect(noPaymentRequestCount).toBe(1)

    releaseNoPaymentRequest()
    await expect(noPaymentDialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
    await expect(noPaymentDialog.getByRole('button', { name: 'Go back' })).toBeEnabled()
    await expect(page.getByTestId('wizard-back-button')).toBeEnabled()
    await page.unroute('**/api/guided-workflow')

    await noPaymentDialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Prepare lab collection' })).toBeVisible()
  })

  test('keeps report generation and upload beside each other on portrait tablets and preserves the client check', async ({
    page,
  }) => {
    const env = getE2EEnv({ pdfs: ['instant'] })
    await page.setViewportSize({ width: 768, height: 1024 })
    await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByText('No payment needed', { exact: true })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeHidden()
    await page.screenshot({ path: test.info().outputPath('payment-prepaid.png'), fullPage: true })
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Generate & upload report' })).toBeVisible({ timeout: 30_000 })
    const panes = page.getByTestId('report-preparation-panes').locator(':scope > section')
    await expect(panes).toHaveCount(2)
    const [generate, upload] = await Promise.all([panes.nth(0).boundingBox(), panes.nth(1).boundingBox()])
    expect(generate).not.toBeNull()
    expect(upload).not.toBeNull()
    expect(Math.abs(generate!.y - upload!.y)).toBeLessThanOrEqual(1)
    expect(upload!.x).toBeGreaterThanOrEqual(generate!.x + generate!.width - 1)
    await expect(page.getByText('Waiting for PDF', { exact: true })).toBeVisible()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: test.info().outputPath('report-portrait.png'), fullPage: true })
    await uploadSinglePdf(page, env.pdfInstantPath)
    await expect(page.getByText('PDF uploaded', { exact: true })).toBeVisible()
    await clickNext(page)
    await waitForExtractStepReady(page)
    const acknowledgement = page.getByRole('checkbox', {
      name: 'This is the same person',
    })
    await expect(acknowledgement).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    const comparison = page.getByRole('table', { name: 'Client identification comparison' })
    await expect(comparison.getByRole('columnheader', { name: 'Website client' })).toBeVisible()
    await expect(comparison.getByRole('columnheader', { name: 'ToxAccess report' })).toBeVisible()
    await expect(comparison.getByRole('rowheader', { name: 'Name', exact: true })).toBeVisible()
    await expect(comparison.getByRole('rowheader', { name: 'Birth date', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: "Name and birth date don't match", exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review report data' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: test.info().outputPath('report-client-check.png'), fullPage: true })
    await acknowledgement.check()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Verify medications' })).toBeVisible()
    await page.getByTestId('wizard-back-button').click()
    await page.getByRole('button', { name: 'Replace PDF', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Generate & upload report' })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('bookingId')).toBe(scheduleFixtures.bookings.paidLinked.id)
    await page.setViewportSize({ width: 390, height: 844 })
    const [phoneGenerate, phoneUpload] = await Promise.all([panes.nth(0).boundingBox(), panes.nth(1).boundingBox()])
    expect(phoneUpload!.y).toBeGreaterThanOrEqual(phoneGenerate!.y + phoneGenerate!.height - 1)
    await expectNoHorizontalOverflow(page)
    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page)
    await expect(acknowledgement).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await expectNoHorizontalOverflow(page)
  })

  test('carries a guided instant booking into the instant workflow', async ({ page }) => {
    const queryErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('No queryFn was passed'))
        queryErrors.push(message.text())
    })
    const env = getE2EEnv({ requirePdfs: false })
    const booking = scheduleFixtures.bookings.paidLinked

    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    await expect(page.getByText('No payment needed', { exact: true })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeHidden()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: /Generate & upload report/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: 'Open ToxAccess', exact: true })).toBeVisible()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await expect(page.getByText('Verify medications', { exact: true })).toHaveCount(0)
    const paymentBefore = (
      await (
        await page.request.get(`/api/bookings/${booking.id}?depth=0`, {
          headers: { Origin: new URL(page.url()).origin },
        })
      ).json()
    ).payment
    await page.getByTestId('wizard-back-button').click()
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('bookingId')).toBe(booking.id)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: /Generate & upload report/i })).toBeVisible({ timeout: 30_000 })
    const paymentAfter = (
      await (
        await page.request.get(`/api/bookings/${booking.id}?depth=0`, {
          headers: { Origin: new URL(page.url()).origin },
        })
      ).json()
    ).payment
    expect(paymentAfter.amountPaid).toBe(paymentBefore.amountPaid)
    expect(paymentAfter.workflowOperationId).toBe(paymentBefore.workflowOperationId)

    const instantUrl = new URL(page.url())
    expect(instantUrl.searchParams.get('workflow')).toBe('instant-test')
    expect(instantUrl.searchParams.get('bookingId')).toBe(booking.id)
    expect(instantUrl.searchParams.get('clientId')).toBe(fixtures.clients.instant.id)
    expect(instantUrl.searchParams.get('testType')).toBe('17-panel-instant')
    expect(instantUrl.searchParams.get('returnTo')).toBe('guided')

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page)

    const mismatchConfirmation = page.getByRole('checkbox', {
      name: 'This is the same person',
    })
    if (await mismatchConfirmation.isVisible().catch(() => false)) {
      await mismatchConfirmation.check()
    }

    await clickNext(page)
    await expect(page.getByText('Verify medications')).toBeVisible()
    await clickNext(page)
    await expect(page.getByText('Verify instant test')).toBeVisible()
    await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
    await expect(page.getByRole('textbox', { name: /Test Type/i })).toHaveValue('17-Panel Instant')
    await page.getByRole('button', { name: 'Reset Wizard', exact: true }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule", exact: true })).toBeVisible()
    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('checkbox', { name: /I verified .* is the person testing today/i })).not.toBeChecked()
    expect(queryErrors).toEqual([])
  })

  test('carries an unpaid guided lab booking into lab collection', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    const booking = scheduleFixtures.bookings.unlinked

    await scheduleCardButton(page, booking.attendeeName).click()
    const registeredClient = scheduleFixtures.bookings.unlinked.registeredClient
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await selectClientFromSearchDialog(page, registeredClient.fullName)

    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(registeredClient.fullName, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: "Booking name doesn't match the client", exact: true })).toHaveCount(
      0,
    )

    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    await expect(page.getByText(fixtures.clients.instant.fullName, { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(fixtures.clients.instant.firstName, 'i') }),
    ).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeEnabled()

    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    const amountReceived = page.getByRole('spinbutton', { name: 'Amount received now' })
    const payAllButton = page.getByRole('button', { name: 'Set amount received to $40.00', exact: true })
    await expect(amountReceived).toHaveValue('0')
    await expect(page.getByTestId('client-amount-due')).toHaveText('$40.00')
    await amountReceived.fill('50')
    await page.getByRole('button', { name: 'Payment breakdown', exact: true }).click()
    await expect(page.getByText('Credit remaining: $10.00')).toBeVisible()
    await payAllButton.click()
    await expect(amountReceived).toHaveValue('40')
    await expect(page.getByText('Credit remaining: $0.00')).toBeVisible()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Prepare lab collection' })).toBeVisible()

    await expect(page.getByRole('heading', { name: '1. Generate report' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '2. Continue here' })).toBeVisible()
    const preparationPanes = page.getByTestId('report-preparation-panes').locator(':scope > section')
    const [generationPane, continuePane] = await Promise.all([
      preparationPanes.nth(0).boundingBox(),
      preparationPanes.nth(1).boundingBox(),
    ])
    expect(Math.abs(generationPane!.y - continuePane!.y)).toBeLessThanOrEqual(1)
    expect(continuePane!.x).toBeGreaterThanOrEqual(generationPane!.x + generationPane!.width - 1)
    const reportConfirmation = page.getByRole('checkbox', { name: 'I created the report in ToxAccess' })
    await expect(reportConfirmation).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toHaveCount(1)
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await expect(page.getByText('Create report before continuing', { exact: true })).toBeVisible()
    await expect(page.getByText('ToxAccess setup could not be verified.', { exact: true })).toBeHidden()
    await reportConfirmation.click()
    await expect(reportConfirmation).toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
    await reportConfirmation.click()
    await expect(reportConfirmation).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await reportConfirmation.click()
    await expect(reportConfirmation).toBeChecked()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: test.info().outputPath('lab-report-portrait.png'), fullPage: true })
    await page.getByTestId('wizard-back-button').click()
    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Prepare lab collection' })).toBeVisible()
    await expect(reportConfirmation).toBeChecked()
    await clickNext(page)
    await expect(page.getByText('Verify medications')).toBeVisible({ timeout: 30_000 })

    const labUrl = new URL(page.url())
    expect(labUrl.searchParams.get('workflow')).toBe('collect-lab')
    expect(labUrl.searchParams.get('step')).toBe('medications')
    expect(labUrl.searchParams.get('bookingId')).toBe(booking.id)
    expect(labUrl.searchParams.get('clientId')).toBe(fixtures.clients.instant.id)
    expect(labUrl.searchParams.get('testType')).toBe('11-panel-lab')
    expect(labUrl.searchParams.get('returnTo')).toBe('guided')

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Confirm lab collection' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit test details', exact: true }).click()
    await expect(page.getByRole('radio', { name: /^11-Panel$/i })).toBeChecked()
  })
})
