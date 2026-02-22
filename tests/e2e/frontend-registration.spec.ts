import { expect, test, type Page } from '@playwright/test'
import { deleteClientAndRelatedDataByEmail, findClientByEmail } from './helpers/db-assert'
import { getE2EEnv } from './helpers/env'
import { ensureMailpitReachable, findMailpitMessages } from './helpers/mailpit'

const EMPLOYER_DOCS = [
  {
    id: 'employer-1',
    name: 'Acme Logistics',
    contacts: [{ name: 'HR Desk', email: 'hr@acme.example' }],
    recipientEmails: [{ email: 'hr@acme.example' }],
  },
  {
    id: 'employer-2',
    name: 'North Harbor Clinic',
    contacts: [{ name: 'Compliance Team', email: 'compliance@northharbor.example' }],
    recipientEmails: [{ email: 'compliance@northharbor.example' }],
  },
]

const COURT_DOCS = [
  {
    id: 'court-1',
    name: 'Wayne County Court',
    contacts: [{ name: 'Probation Desk', email: 'probation@waynecourt.example' }],
    recipientEmails: [{ email: 'probation@waynecourt.example' }],
    preferredTestType: {
      label: '15 Panel Instant',
      value: '15-panel',
    },
  },
  {
    id: 'court-2',
    name: 'Oakland County Court',
    contacts: [{ name: 'Court Clerk', email: 'clerk@oaklandcourt.example' }],
    recipientEmails: [{ email: 'clerk@oaklandcourt.example' }],
  },
]

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.com`
}

const createdClientEmails: string[] = []

async function mockReferralLookups(page: Page) {
  await page.route('**/api/employers**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docs: EMPLOYER_DOCS }),
    })
  })

  await page.route('**/api/courts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docs: COURT_DOCS }),
    })
  })
}

async function openRegistration(page: Page) {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible()
}

async function fillPersonalInfo(page: Page) {
  await page.getByLabel('First Name').fill('Alex')
  await page.getByLabel('Last Name').fill('Taylor')
  await page.locator('[id="personalInfo.gender"]').click()
  await page.getByRole('option', { name: 'Male', exact: true }).click()
  await page.getByLabel('Date of Birth').fill('01/15/1990')
  await page.getByLabel('Date of Birth').press('Tab')
  await page.getByLabel('Phone Number').fill('2485551212')
}

async function fillAccountInfo(page: Page, emailPrefix: string) {
  await page.getByLabel('Email Address').fill(uniqueEmail(emailPrefix))
  await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
  await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
}

async function goToRecipients(page: Page, requestedBy: 'self' | 'employer' | 'court', emailPrefix: string) {
  await openRegistration(page)
  await fillPersonalInfo(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Account Info' })).toBeVisible()
  await fillAccountInfo(page, emailPrefix)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Screening Request' })).toBeVisible()
  const requestedByLabel = requestedBy === 'self' ? 'Self' : requestedBy === 'employer' ? 'Employer' : 'Court'
  await page.getByRole('radio', { name: new RegExp(requestedByLabel, 'i') }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Results Recipients' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await mockReferralLookups(page)
})

test.afterAll(async () => {
  for (const email of createdClientEmails) {
    await deleteClientAndRelatedDataByEmail(email)
  }
})

test('validates steps, supports back-forward navigation, and validates medications in self flow', async ({
  page,
}) => {
  await openRegistration(page)

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('First name is required')).toBeVisible()
  await expect(page.getByText('Last name is required')).toBeVisible()

  await fillPersonalInfo(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Account Info' })).toBeVisible()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Email is required')).toBeVisible()

  await page.getByLabel('Email Address').fill('not-an-email')
  await page.locator('[id="accountInfo.password"]').fill('weak')
  await page.locator('[id="accountInfo.confirmPassword"]').fill('weak')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Please enter a valid email address')).toBeVisible()
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()

  await page.getByLabel('Email Address').fill(uniqueEmail('self-flow'))
  await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
  await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass124')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText("Passwords don't match")).toBeVisible()

  await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Screening Request' })).toBeVisible()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Please select who is requesting this screening')).toBeVisible()

  await page.getByRole('radio', { name: /Self/i }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Results Recipients' })).toBeVisible()

  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Recipient email is required')).toBeVisible()

  await page.getByLabel('Recipient Email').fill('self-recipient@example.com')

  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByRole('heading', { name: 'Screening Request' })).toBeVisible()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Results Recipients' })).toBeVisible()
  await expect(page.getByLabel('Recipient Email')).toHaveValue('self-recipient@example.com')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()

  await page.getByRole('button', { name: 'Add Medication' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Medication name is required')).toBeVisible()
  await expect(page.getByText('Select at least one detected substance')).toBeVisible()

  await page.locator('[id="medications[0].medicationName"]').fill('Suboxone')
  await page.getByLabel('Buprenorphine').check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Terms & Conditions' })).toBeVisible()
  await page.getByRole('button', { name: 'Complete Registration' }).click()
  await expect(page.getByText('You must agree to the terms and conditions')).toBeVisible()
})

test('supports employer preset referral with additional recipient', async ({ page }) => {
  await goToRecipients(page, 'employer', 'employer-preset')

  await page.locator('#employer-select').selectOption('employer-1')
  await expect(page.getByText('hr@acme.example')).toBeVisible()

  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByLabel('Recipient Email').fill('employee-personal@example.com')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()
})

test('supports employer new referral with preset and personal additional recipients', async ({ page }) => {
  await goToRecipients(page, 'employer', 'employer-new')

  await page.locator('#employer-select').selectOption('other')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Employer name is required')).toBeVisible()
  await expect(page.getByText('Main contact email is required')).toBeVisible()

  await page.getByLabel('Employer Name').fill('Summit Manufacturing')
  await page.getByLabel('Contact Email').fill('contact@summit.example')

  const addRecipientButtons = page.getByRole('button', { name: 'Add Recipient' })
  await expect(addRecipientButtons).toHaveCount(2)

  await addRecipientButtons.first().click()
  await page.getByLabel('Recipient Email').first().fill('manager@summit.example')

  await addRecipientButtons.nth(1).click()
  await page.getByLabel('Recipient Email').nth(1).fill('self-extra@example.com')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()
})

test('supports court preset referral with additional recipient', async ({ page }) => {
  await goToRecipients(page, 'court', 'court-preset')

  await page.locator('#court-select').selectOption('court-1')
  await expect(page.getByText('probation@waynecourt.example')).toBeVisible()
  await expect(page.getByText('Preferred test type:')).toBeVisible()

  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByLabel('Recipient Email').fill('court-self-extra@example.com')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()
})

test('supports court new referral with preset and personal additional recipients', async ({ page }) => {
  await goToRecipients(page, 'court', 'court-new')

  await page.locator('#court-select').selectOption('other')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Court name is required')).toBeVisible()
  await expect(page.getByText('Main contact email is required')).toBeVisible()

  await page.getByLabel('Court Name').fill('Lakeside District Court')
  await page.getByLabel('Contact Email').fill('clerk@lakesidecourt.example')

  const addRecipientButtons = page.getByRole('button', { name: 'Add Recipient' })
  await expect(addRecipientButtons).toHaveCount(2)

  await addRecipientButtons.first().click()
  await page.getByLabel('Recipient Email').first().fill('probation@lakesidecourt.example')

  await addRecipientButtons.nth(1).click()
  await page.getByLabel('Recipient Email').nth(1).fill('self-court-extra@example.com')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()
})

test('submits frontend registration and verifies verification/admin emails in Mailpit', async ({ page }) => {
  const env = getE2EEnv({ requirePdfs: false })
  await ensureMailpitReachable(env.mailpitApiBase)

  const registrationEmail = uniqueEmail('frontend-submit')
  const testStart = new Date()

  await openRegistration(page)
  await fillPersonalInfo(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Account Info' })).toBeVisible()
  await page.getByLabel('Email Address').fill(registrationEmail)
  await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
  await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Screening Request' })).toBeVisible()
  await page.getByRole('radio', { name: /Self/i }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Results Recipients' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByLabel('Recipient Email').fill(`self.extra.${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Medications (Optional)' })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Terms & Conditions' })).toBeVisible()
  await page.getByLabel(/I have read and agree to the terms and conditions of service/i).check()
  await page.getByRole('button', { name: 'Complete Registration' }).click()

  await expect(page.getByRole('heading', { name: 'Registration Complete' })).toBeVisible()
  await expect(page.getByText('Verification Email Sent')).toBeVisible()
  await expect(page.getByText(registrationEmail)).toBeVisible()

  createdClientEmails.push(registrationEmail)

  const createdClient = await findClientByEmail(registrationEmail)
  expect(createdClient).not.toBeNull()

  await findMailpitMessages({
    apiBase: env.mailpitApiBase,
    createdAfter: testStart,
    to: registrationEmail,
    subject: 'Verify Your Email Address - MI Drug Test',
    requireAttachment: 'none',
    timeoutMs: 30_000,
  })

  await findMailpitMessages({
    apiBase: env.mailpitApiBase,
    createdAfter: testStart,
    to: ['mike@midrugtest.com', 'tom@midrugtest.com'],
    subject: 'New Client Registration - Alex Taylor',
    requireAttachment: 'none',
    timeoutMs: 30_000,
  })
})
