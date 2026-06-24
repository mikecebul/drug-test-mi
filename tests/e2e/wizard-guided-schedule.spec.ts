import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
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

function scheduleCard(page: Page, attendeeName: string) {
  return page.getByRole('button').filter({ hasText: attendeeName }).first()
}

async function openGuidedSchedule(page: Page) {
  await page.goto('/admin/drug-test-upload?workflow=guided&step=schedule', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Loading appointments...')).toBeHidden({ timeout: 30_000 })
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
    await expect(needsTestType).toContainText('Set test')

    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.outsideToday.attendeeName }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button').filter({ hasText: scheduleFixtures.bookings.cancelledToday.attendeeName }),
    ).toHaveCount(0)
  })

  test('opens the correct next step from each schedule card', async ({ page }) => {
    await scheduleCard(page, scheduleFixtures.bookings.unlinked.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Confirm Client' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Register New Client/i })).toBeVisible()
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCard(page, scheduleFixtures.bookings.needsTestType.attendeeName).click()
    await expect(page.getByRole('heading', { name: 'Set Appointment Test' })).toBeVisible()
    await expect(page.getByText('What test is needed today?')).toBeVisible()
    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()

    await scheduleCard(page, scheduleFixtures.bookings.paidLinked.attendeeName).click()
    await expect(page.getByText('Appointment Review')).toBeVisible()
    await expect(page.getByText('Payment Required')).toBeVisible()
    await expect(page.getByText(fixtures.clients.collectLab.email)).toBeVisible()
    await expect(page.getByText('2485550199@sms.cal.com')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: /^Paid/i })).toBeChecked()
    await expect(page.getByText('Already paid through the booking.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Pre-paid/i })).toHaveCount(0)
  })
})
