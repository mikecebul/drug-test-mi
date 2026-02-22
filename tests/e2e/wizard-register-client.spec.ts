import { expect, test, type Page } from '@playwright/test'
import { cleanupFixtures } from './helpers/cleanup'
import { findClientByEmail, deleteClientAndRelatedDataByEmail } from './helpers/db-assert'
import { loginAdmin } from './helpers/auth'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { openWizard, selectWorkflow } from './helpers/wizard'

let fixtures: FixtureContext
const createdClientEmails: string[] = []

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.com`
}

async function fillPersonalInfo(page: Page) {
  const firstNameInput = page.getByRole('textbox', { name: /^First Name/i })
  const lastNameInput = page.getByRole('textbox', { name: /^Last Name/i })

  await expect(firstNameInput).toBeVisible()
  await expect(firstNameInput).toBeEditable()
  await expect(lastNameInput).toBeVisible()
  await expect(lastNameInput).toBeEditable()

  await firstNameInput.fill('Admin')
  await expect(firstNameInput).toHaveValue('Admin')

  await lastNameInput.fill('Registrant')
  await expect(lastNameInput).toHaveValue('Registrant')

  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: /^Male$/i }).click()
  await page.getByLabel('Date of Birth').fill('01/15/1990')
  await page.getByLabel('Date of Birth').press('Tab')
  await page.getByLabel('Phone Number').fill('2485551212')
  await expect(page.getByRole('button', { name: /^Next$/i })).toBeEnabled()
}

async function fillAccountInfo(page: Page, email: string) {
  await page.locator('input[name="accountInfo.email"]').fill(email)
  await page.locator('input[name="accountInfo.password"]').fill('StrongPass123')
  await page.locator('input[name="accountInfo.confirmPassword"]').fill('StrongPass123')
}

test.describe('Wizard Register Client', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    fixtures = await seedFixtures()
  })

  test.afterAll(async () => {
    for (const email of createdClientEmails) {
      await deleteClientAndRelatedDataByEmail(email)
    }
    await cleanupFixtures(fixtures)
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, fixtures.admin)
    await openWizard(page)
    await selectWorkflow(page, 'Register New Client')
  })

  test('validates required fields and supports back-forward in recipient setup', async ({ page }) => {
    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText('First name is required')).toBeVisible()
    await expect(page.getByText('Last name is required')).toBeVisible()

    await fillPersonalInfo(page)
    await page.getByRole('button', { name: /^Next$/i }).click()

    await expect(page.getByText('Account Information')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText('Email is required')).toBeVisible()

    await fillAccountInfo(page, uniqueEmail('wizard-admin-validation'))
    await page.getByRole('button', { name: /^Next$/i }).click()

    await expect(page.getByText('Screening Type')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('radio', { name: /Employer/i }).check()
    await page.getByRole('button', { name: /^Next$/i }).click()

    await expect(page.getByText('Results Recipients')).toBeVisible({ timeout: 20_000 })
    await page.locator('#employer-select').selectOption(fixtures.referrals.employer.id)

    await page.getByRole('button', { name: /Add Recipient/i }).click()
    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText('Recipient email is required')).toBeVisible()

    await page.getByLabel('Recipient Email').fill(`admin.recipient.${Date.now()}@example.com`)

    await page.getByRole('button', { name: /^Back$/i }).click()
    await expect(page.getByText('Screening Type')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText('Results Recipients')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel('Recipient Email')).toHaveValue(/admin\.recipient\./)
  })

  test('submits register-client workflow and persists referral configuration', async ({ page }) => {
    const email = uniqueEmail('wizard-admin-submit')

    await fillPersonalInfo(page)
    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText('Account Information')).toBeVisible({ timeout: 20_000 })

    await fillAccountInfo(page, email)
    await page.getByRole('button', { name: /^Next$/i }).click()

    await page.getByRole('radio', { name: /Employer/i }).check()
    await page.getByRole('button', { name: /^Next$/i }).click()

    await page.locator('#employer-select').selectOption(fixtures.referrals.employer.id)
    await page.getByRole('button', { name: /Add Recipient/i }).click()
    await page.getByLabel('Recipient Email').fill(`submit.ref.${Date.now()}@example.com`)
    await page.getByRole('button', { name: /^Next$/i }).click()

    await expect(page.getByText('Terms & Conditions')).toBeVisible({ timeout: 20_000 })
    await page.getByLabel(/I confirm the client has been informed and consents to testing/i).check()
    await page.getByRole('button', { name: /Register Client/i }).click()

    await expect(page.getByRole('heading', { name: 'Registration Complete' })).toBeVisible({ timeout: 20_000 })

    createdClientEmails.push(email)

    const client = await findClientByEmail(email)
    expect(client).not.toBeNull()
    expect(client?.referralType).toBe('employer')

    const referral = client?.referral as { relationTo?: string; value?: string } | undefined
    expect(referral?.relationTo).toBe('employers')
    expect(referral?.value).toBe(fixtures.referrals.employer.id)

    const additionalRecipients = (client?.referralAdditionalRecipients || []) as Array<{ email?: string }>
    expect(additionalRecipients.length).toBeGreaterThan(0)
  })
})
