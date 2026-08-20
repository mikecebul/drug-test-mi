import { devices, expect, test, type Locator, type Page } from '@playwright/test'
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
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

async function expectReceivesPointerAtCenter(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const hitTarget = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return hitTarget === element || element.contains(hitTarget)
      }),
    )
    .toBe(true)
}

async function expectFirstTwoBadgesUnclampedAndAdjacent(page: Page, rowSelector: string) {
  await expect
    .poll(() =>
      page.locator(rowSelector).evaluate((row) => {
        const badges = Array.from(row.querySelectorAll<HTMLElement>('[data-slot="badge"]')).slice(0, 2)
        if (badges.length !== 2) return Number.POSITIVE_INFINITY

        const [first, second] = badges.map((badge) => badge.getBoundingClientRect())
        return Math.max(
          Math.abs(first.height - second.height),
          Math.abs(first.top - second.top),
          Math.abs(second.left - first.right - 8),
          ...badges.map((badge) =>
            Math.max(badge.scrollWidth - badge.clientWidth, badge.scrollHeight - badge.clientHeight),
          ),
        )
      }),
    )
    .toBeLessThanOrEqual(1)
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
    await expect(paidLinked.getByText('Male')).toHaveClass(/text-blue-900/)
    await expect(
      paidLinked.locator('span').filter({ hasText: scheduleFixtures.bookings.paidLinked.attendeeName }).first(),
    ).toContainText('Male')
    await expect(
      paidLinked.getByText(`${formatScheduleTime(scheduleFixtures.bookings.paidLinked.startTime)} Male`),
    ).toHaveCount(0)
    await expect(paidLinked).toContainText('Pre-paid')
    await expect(paidLinked.getByText('Pre-paid')).toHaveClass(/bg-success/)

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
      await expectReceivesPointerAtCenter(saveClientButton)
      await clientEditor.getByLabel('Phone', { exact: true }).fill('2485550199')
      await saveClientButton.tap()
      await expect(clientEditor).toBeHidden()
      await expect(page.getByText('Client details updated')).toBeVisible()
      await expect(page.getByText('(248) 555-0199', { exact: true })).toBeVisible()

      const mismatchConfirmation = page.getByRole('checkbox', {
        name: /I verified .* is the person testing today/i,
      })
      await mismatchConfirmation.tap()

      const reviewNextButton = page.getByTestId('wizard-next-button')
      await expectReceivesPointerAtCenter(reviewNextButton)
      await reviewNextButton.tap()
      const noHeadshotDialog = page.getByRole('alertdialog', { name: 'Continue without a headshot?' })
      await expect(noHeadshotDialog).toBeVisible()
      await noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).tap()
      await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
      await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toBeVisible()
      await expect(page.getByTestId('wizard-next-button')).toBeVisible()
      await expectNoHorizontalOverflow(page)

      const cashMethod = page.getByRole('button', { name: 'Cash payment method' })
      const cardMethod = page.getByRole('button', { name: 'Card payment method' })
      await expect(cashMethod).toHaveAttribute('aria-pressed', 'true')
      await expect(cardMethod).toHaveAttribute('aria-pressed', 'false')
      await expect(cashMethod).toHaveCSS('opacity', '1')
      await expect(cardMethod).toHaveCSS('opacity', '0.6')
      await cardMethod.tap()
      await expect(cardMethod).toHaveAttribute('aria-pressed', 'true')
      await expect(cashMethod).toHaveAttribute('aria-pressed', 'false')
      await expect(cardMethod).toHaveCSS('opacity', '1')
      await expect(cashMethod).toHaveCSS('opacity', '0.6')
      await expect
        .poll(async () => {
          const [amountBox, methodBox, cashBox, cardBox] = await Promise.all([
            page.getByTestId('amount-received-control').boundingBox(),
            page.getByTestId('payment-method-control').boundingBox(),
            cashMethod.boundingBox(),
            cardMethod.boundingBox(),
          ])
          if (!amountBox || !methodBox || !cashBox || !cardBox) return Number.POSITIVE_INFINITY
          return Math.max(
            Math.abs(amountBox.width - methodBox.width),
            Math.abs(cashBox.width - cardBox.width),
            Math.abs(amountBox.height - cashBox.height),
            Math.abs(amountBox.height - cardBox.height),
          )
        })
        .toBeLessThanOrEqual(1)
    } finally {
      await context.close()
    }
  })

  test('keeps dashboard and guided schedule rows consistent on mobile and portrait iPad', async ({ page }) => {
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
      const dashboardRowSelector = `[aria-label="Collect Test for ${scheduleFixtures.bookings.paidLinked.attendeeName}"]`
      await expect(workflowLink).toBeVisible()
      await expect(scheduleRow).toContainText('Pre-paid')
      await expectFirstTwoBadgesUnclampedAndAdjacent(page, dashboardRowSelector)
      await expect
        .poll(async () => (await scheduleRow.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
        .toBeLessThanOrEqual(136)
      await expect
        .poll(async () => {
          const [linkBox, rowBox] = await Promise.all([workflowLink.boundingBox(), scheduleRow.boundingBox()])
          if (!linkBox || !rowBox) return Number.POSITIVE_INFINITY
          return Math.abs(linkBox.height - rowBox.height)
        })
        .toBeLessThanOrEqual(2)

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
      const guidedRow = scheduleCard(page, scheduleFixtures.bookings.paidLinked.attendeeName)
      const guidedButton = scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName)
      await expectFirstTwoBadgesUnclampedAndAdjacent(
        page,
        `button:has-text("${scheduleFixtures.bookings.paidLinked.attendeeName}")`,
      )
      await expect
        .poll(async () => {
          const [buttonBox, rowBox] = await Promise.all([guidedButton.boundingBox(), guidedRow.boundingBox()])
          if (!buttonBox || !rowBox) return Number.POSITIVE_INFINITY
          return Math.abs(buttonBox.height - rowBox.height)
        })
        .toBeLessThanOrEqual(2)

      await expectNoHorizontalOverflow(page)
    }
  })

  test('keeps the Walk-In icon and title aligned on mobile and portrait iPad', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport)
      await openGuidedSchedule(page)

      const walkInTitleRow = page.getByTestId('guided-walk-in-title-row')
      await expect(walkInTitleRow.getByRole('heading', { name: 'Walk-In Collection' })).toBeVisible()
      await expect
        .poll(async () => {
          const [iconBox, titleBox] = await Promise.all([
            walkInTitleRow.locator('svg').boundingBox(),
            walkInTitleRow.getByRole('heading', { name: 'Walk-In Collection' }).boundingBox(),
          ])
          if (!iconBox || !titleBox) return Number.POSITIVE_INFINITY
          return Math.abs(iconBox.y + iconBox.height / 2 - (titleBox.y + titleBox.height / 2))
        })
        .toBeLessThanOrEqual(1)
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
    await expect(page.getByText('Booking name does not match the selected client')).toBeVisible()
    await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
    await expect(page.getByText('Male')).toHaveClass(/text-blue-900/)
    await expect(
      page.getByText(`${formatScheduleTime(scheduleFixtures.bookings.paidLinked.startTime)} · Male`),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toHaveCount(0)
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Amount received now' })).toHaveValue('0')
    await expect(page.getByRole('button', { name: 'Cash payment method' })).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('group', { name: 'Quick amount received' }).getByRole('button', {
        name: 'Set amount received to $0',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Today · 17-Panel Instant')).toBeVisible()
    await expect(page.getByText('Current test · $0 due')).toBeVisible()
    await expect(page.getByText('$0 applied', { exact: true })).toBeVisible()
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
    await expect(clientEditor).toBeHidden()

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
    await expect(clientEditor).toBeHidden()

    await nextButton.click()
    await expect(noHeadshotDialog).toBeVisible()
    await noHeadshotDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(noHeadshotDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()

    await nextButton.click()
    await expect(noHeadshotDialog).toBeVisible()
    await noHeadshotDialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
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
      await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()

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

    const quickBookTrigger = page.getByRole('button', { name: 'Quick Book', exact: true })

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

  test('applies client credit and can undo the recorded payment', async ({ page }) => {
    const booking = scheduleFixtures.bookings.creditAvailable

    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
    await expect(page.getByText('Credit available')).toBeVisible()
    await expect(page.getByText('$40 available')).toBeVisible()
    await expect(page.getByText('Total Due', { exact: true })).toBeVisible()

    const creditInput = page.getByRole('spinbutton', { name: 'Credit to apply' })
    const amountReceived = page.getByRole('spinbutton', { name: 'Amount received now' })
    await expect(creditInput).toHaveValue('0')
    await expect(amountReceived).toHaveValue('0')

    await page.getByRole('button', { name: 'Apply $40 credit' }).click()
    await expect(creditInput).toHaveValue('40')
    await expect(amountReceived).toHaveValue('0')
    await expect(page.getByText('$40 credit', { exact: true })).toBeVisible()
    await expect(page.getByText('Credit remaining').last()).toBeVisible()

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()
    await page.getByRole('button', { name: /^Back$/ }).click()

    const receipt = page.getByTestId('guided-recorded-payment')
    await expect(receipt.getByRole('heading', { name: 'Payment recorded' })).toBeVisible()
    await expect(receipt).toContainText('Client credit')
    await expect(receipt).toContainText("Applied to today's test")
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

    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
    await expect(page.getByText('$40 available')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()
  })

  test('carries a guided instant booking into the instant workflow', async ({ page }) => {
    const env = getE2EEnv({ requirePdfs: false })
    const booking = scheduleFixtures.bookings.paidLinked

    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()
    await expect(page.getByTestId('client-identity-mismatch')).toHaveCount(0)

    await page.getByRole('button', { name: /Continue Collection/i }).click()
    await expect(page.getByRole('heading', { name: /Upload Instant Drug Test Report/i })).toBeVisible({
      timeout: 30_000,
    })

    const instantUrl = new URL(page.url())
    expect(instantUrl.searchParams.get('workflow')).toBe('instant-test')
    expect(instantUrl.searchParams.get('bookingId')).toBe(booking.id)
    expect(instantUrl.searchParams.get('clientId')).toBe(fixtures.clients.instant.id)
    expect(instantUrl.searchParams.get('testType')).toBe('17-panel-instant')
    expect(instantUrl.searchParams.get('returnTo')).toBe('guided')

    await uploadSinglePdf(page, env.pdfInstantPath)
    await clickNext(page)
    await waitForExtractStepReady(page, { readyHeadings: [/Extract Data/i] })

    const mismatchConfirmation = page.getByRole('checkbox', {
      name: /confirm it belongs to this client/i,
    })
    if (await mismatchConfirmation.isVisible().catch(() => false)) {
      await mismatchConfirmation.check()
    }

    await clickNext(page)
    await expect(page.getByText('Verify Medications')).toBeVisible()
    await clickNext(page)
    await expect(page.getByText('Verify Test Data')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /Test Type/i })).toHaveValue('17-Panel Instant')
  })

  test('carries an unpaid guided lab booking into lab collection', async ({ page }) => {
    const booking = scheduleFixtures.bookings.unlinked

    await scheduleCardButton(page, booking.attendeeName).click()
    const registeredClient = scheduleFixtures.bookings.unlinked.registeredClient
    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible()
    await selectClientFromSearchDialog(page, registeredClient.fullName)

    await expect(page.getByRole('heading', { name: 'Review Client & Appointment' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(registeredClient.fullName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Booking name does not match the selected client')).toHaveCount(0)

    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    await expect(page.getByText(fixtures.clients.instant.fullName, { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(fixtures.clients.instant.firstName, 'i') }),
    ).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeEnabled()

    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Payment', exact: true })).toBeVisible()
    const amountReceived = page.getByRole('spinbutton', { name: 'Amount received now' })
    const quickAmountGroup = page.getByRole('group', { name: 'Quick amount received' })
    const zeroAmountButton = quickAmountGroup.getByRole('button', { name: 'Set amount received to $0' })
    const payAllButton = quickAmountGroup.getByRole('button', { name: 'Set amount received to $40' })

    await expect(amountReceived).toHaveValue('0')
    await expect(zeroAmountButton).toHaveAttribute('aria-pressed', 'true')
    await expect(payAllButton).toHaveAttribute('aria-pressed', 'false')
    await expect(zeroAmountButton).toHaveCSS('opacity', '1')
    await expect(payAllButton).toHaveCSS('opacity', '0.6')
    await expect(page.getByText('Today · 11-Panel Lab')).toBeVisible()
    await expect(page.getByText('Current test · $40 due')).toBeVisible()
    await expect(page.getByText('$0 applied', { exact: true })).toBeVisible()

    await amountReceived.fill('50')
    await expect(page.getByText('Includes $10 new credit')).toBeVisible()
    await expect(zeroAmountButton).toHaveAttribute('aria-pressed', 'false')
    await expect(payAllButton).toHaveAttribute('aria-pressed', 'false')
    await expect(zeroAmountButton).toHaveCSS('opacity', '0.6')
    await expect(payAllButton).toHaveCSS('opacity', '0.6')

    await payAllButton.click()
    await expect(amountReceived).toHaveValue('40')
    await expect(zeroAmountButton).toHaveAttribute('aria-pressed', 'false')
    await expect(payAllButton).toHaveAttribute('aria-pressed', 'true')
    await expect(zeroAmountButton).toHaveCSS('opacity', '0.6')
    await expect(payAllButton).toHaveCSS('opacity', '1')
    await expect(page.getByText('Includes $10 new credit')).toHaveCount(0)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()

    await page.getByRole('button', { name: /Continue Collection/i }).click()
    await expect(page.getByText('Verify Medications')).toBeVisible({ timeout: 30_000 })

    const labUrl = new URL(page.url())
    expect(labUrl.searchParams.get('workflow')).toBe('collect-lab')
    expect(labUrl.searchParams.get('step')).toBe('medications')
    expect(labUrl.searchParams.get('bookingId')).toBe(booking.id)
    expect(labUrl.searchParams.get('clientId')).toBe(fixtures.clients.instant.id)
    expect(labUrl.searchParams.get('testType')).toBe('11-panel-lab')
    expect(labUrl.searchParams.get('returnTo')).toBe('guided')

    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Confirm Details' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^11-Panel$/i })).toBeChecked()
  })
})
