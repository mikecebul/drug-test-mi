import { expect, test, type Page } from '@playwright/test'
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

async function verifyGuidedClientMismatch(page: Page) {
  const mismatchConfirmation = page.getByRole('checkbox', {
    name: /I verified .* is the person testing today/i,
  })
  await expect(mismatchConfirmation).toBeVisible()
  await mismatchConfirmation.check()
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

  test('shows only confirmed or pending bookings in the app-timezone day window', async ({ page }) => {
    const todayCards = page.getByRole('button').filter({ hasText: fixtures.runId })
    await expect(todayCards).toHaveCount(3)

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
    await expect(needsTestType).toContainText('Set test')

    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.outsideToday.attendeeName }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.cancelledToday.attendeeName }),
    ).toHaveCount(0)
  })

  test('opens the correct next step from each schedule card', async ({ page }) => {
    await scheduleCardButton(page, scheduleFixtures.bookings.unlinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Confirm Client' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Register New Client/i })).toBeVisible()
    await expect(page.getByText('Registered client found')).toBeVisible()
    const exactMatches = page.getByTestId('guided-exact-client-matches')
    await expect(exactMatches).toContainText(scheduleFixtures.bookings.unlinked.registeredClient.fullName)
    await expect(exactMatches).toContainText('Exact email')
    await expect(page.getByText('Selected client', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCardButton(page, scheduleFixtures.bookings.needsTestType.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Set Appointment Test' })).toBeVisible()
    await expect(page.getByText('What test is needed today?')).toBeVisible()
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCardButton(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review and Payment' })).toBeVisible()
    await expect(page.getByText('Selected client', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(fixtures.clients.instant.fullName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(scheduleFixtures.bookings.paidLinked.attendeeName)).toBeVisible()
    await expect(page.getByText('Booking name does not match the selected client')).toBeVisible()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    await expect(page.getByText('Male')).toHaveClass(/text-blue-900/)
    await expect(
      page.getByText(`${formatScheduleTime(scheduleFixtures.bookings.paidLinked.startTime)} · Male`),
    ).toHaveCount(0)
    await expect(page.getByText('Payment Confirmed')).toBeVisible()
    await expect(page.getByText('Pre-paid through the booking.')).toBeVisible()
    await expect(page.getByText('$35 due today')).toHaveCount(0)
    await expect(page.getByText(fixtures.clients.instant.email)).toBeVisible()
    await expect(page.getByText('2485550199@sms.cal.com')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: /^Paid/i })).toBeChecked()
    await expect(page.getByText('Already paid through the booking.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Pre-paid/i })).toHaveCount(0)
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
    await expect(page.getByRole('heading', { name: 'Set Appointment Test' })).toBeVisible()
  })

  test('carries a guided instant booking into the instant workflow', async ({ page }) => {
    const env = getE2EEnv()
    const booking = scheduleFixtures.bookings.paidLinked

    await scheduleCardButton(page, booking.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Review and Payment' })).toBeVisible()
    await verifyGuidedClientMismatch(page)
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()
    await expect(page.getByText('17-Panel Instant', { exact: true }).last()).toBeVisible()

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
      name: /confirm this is the correct client\/report/i,
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
    await expect(page.getByRole('heading', { name: 'Confirm Client' })).toBeVisible()
    const exactMatches = page.getByTestId('guided-exact-client-matches')
    const registeredClient = scheduleFixtures.bookings.unlinked.registeredClient
    await expect(exactMatches).toContainText(registeredClient.fullName)
    await exactMatches.getByRole('button', { name: new RegExp(registeredClient.fullName, 'i') }).click()

    await expect(page.getByRole('heading', { name: 'Review and Payment' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(registeredClient.fullName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Booking name does not match the selected client')).toHaveCount(0)

    await selectClientFromSearchDialog(page, fixtures.clients.instant.fullName)
    await expect(page.getByText(fixtures.clients.instant.fullName, { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(fixtures.clients.instant.firstName, 'i') }),
    ).not.toBeChecked()
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()

    await verifyGuidedClientMismatch(page)
    await expect(page.getByRole('radio', { name: /^Still owes/i })).toBeChecked()
    await clickNext(page)
    await expect(page.getByRole('heading', { name: 'Collect Sample in ToxAccess' })).toBeVisible()
    await expect(page.getByText(/11-Panel Lab/i).last()).toBeVisible()

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
    await expect(page.getByRole('heading', { name: 'Collection Details' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^11-Panel$/i })).toBeChecked()
  })
})
