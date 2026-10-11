import { expectValidationError } from './helpers/wizard'
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
      label: '17 Panel Instant',
      value: '17-panel-instant',
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
  await expect(page.getByLabel('First Name')).toBeVisible()
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible()
}

async function fillPersonalInfo(page: Page) {
  await page.getByLabel('First Name').fill('Alex')
  await page.getByLabel('Middle Initial').fill('Q')
  await page.getByLabel('Last Name').fill('Taylor')
  await page.locator('[id="personalInfo.gender"]').click()
  await page.getByRole('option', { name: 'Male', exact: true }).click()
  await page.getByLabel('Phone Number').fill('2485551212')
  await page.getByLabel('Date of Birth').fill('01/15/1990')
  await expect(page.getByLabel('First Name')).toHaveValue('Alex')
  await expect(page.getByLabel('Date of Birth')).toHaveValue('01/15/1990')
}

async function fillAccountInfo(page: Page, emailPrefix: string) {
  const email = page.getByLabel('Email Address')
  // Wait for the step's scheduled focus before typing into the next field.
  await expect(email).toBeFocused()
  await email.fill(uniqueEmail(emailPrefix))
  await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
  await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
}

async function goToRecipients(page: Page, requestedBy: 'self' | 'employer' | 'court', emailPrefix: string) {
  await openRegistration(page)
  await fillPersonalInfo(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByLabel('Email Address')).toBeVisible()
  await fillAccountInfo(page, emailPrefix)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('radio', { name: /Self/i })).toBeVisible()
  const requestedByLabel = requestedBy === 'self' ? 'Self' : requestedBy === 'employer' ? 'Employer' : 'Court'
  await page.getByRole('radio', { name: new RegExp(requestedByLabel, 'i') }).check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('button', { name: /Add Recipient/i })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await mockReferralLookups(page)
})

test.afterAll(async () => {
  for (const email of createdClientEmails) {
    await deleteClientAndRelatedDataByEmail(email)
  }
})

for (const scenario of [
  { label: 'missing', dob: undefined },
  { label: 'invalid', dob: 'January 15, 1990' },
]) {
  test(`rejects direct client creation with a ${scenario.label} DOB`, async ({ request }) => {
    const email = uniqueEmail(`direct-${scenario.label}-dob`)
    createdClientEmails.push(email)

    const response = await request.post('/api/clients', {
      data: {
        firstName: 'Direct',
        lastName: 'Validation',
        email,
        password: 'StrongPass123',
        gender: 'prefer-not-to-say',
        phone: '2485551212',
        referralType: 'self',
        preferredContactMethod: 'email',
        ...(scenario.dob ? { dob: scenario.dob } : {}),
      },
    })

    expect(response.status()).toBe(400)
    expect(await findClientByEmail(email)).toBeNull()
  })
}

test('offers only the three supported client gender choices', async ({ page }) => {
  await openRegistration(page)
  await page.locator('[id="personalInfo.gender"]').click()

  const options = page.getByRole('option')
  await expect(options).toHaveCount(3)
  await expect(page.getByRole('option', { name: 'Male', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Female', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Prefer not to say', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Other', exact: true })).toHaveCount(0)
})

test(
  'validates steps, supports back-forward navigation, and validates medications in self flow',
  { tag: '@critical' },
  async ({ page }) => {
    await openRegistration(page)

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.locator('[name="personalInfo.firstName"]'))
    await expectValidationError(page, page.locator('[name="personalInfo.middleInitial"]'))
    await expectValidationError(page, page.locator('[name="personalInfo.lastName"]'))
    await expectValidationError(page, page.getByLabel('Date of Birth'))
    await expect(page.getByLabel('First Name')).toBeFocused()

    await fillPersonalInfo(page)
    await page.getByLabel('Date of Birth').fill('January 15, 1990')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByLabel('First Name')).toBeVisible()
    await expectValidationError(page, page.getByLabel('Date of Birth'))
    await expect(page.getByLabel('Date of Birth')).toBeFocused()

    await page.getByLabel('Date of Birth').fill('01/15/1990')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByLabel('Email Address')).toBeVisible()
    await expect(page.getByLabel('Email Address')).toBeFocused()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.locator('[name="accountInfo.email"]'))
    await expect(page.getByLabel('Email Address')).toBeFocused()

    await page.getByLabel('Email Address').fill('not-an-email')
    await page.locator('[id="accountInfo.password"]').fill('weak')
    await page.locator('[id="accountInfo.confirmPassword"]').fill('weak')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.locator('[name="accountInfo.email"]'))
    await expectValidationError(page, page.locator('[name="accountInfo.password"]'))
    await expect(page.getByLabel('Email Address')).toBeFocused()

    await page.getByLabel('Email Address').fill(uniqueEmail('self-flow'))
    await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
    await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass124')
    await expect(page.getByLabel('Email Address')).toHaveValue(/@example\.com$/)
    await expect(page.locator('[id="accountInfo.password"]')).toHaveValue('StrongPass123')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.locator('[name="accountInfo.confirmPassword"]'))
    await expect(page.locator('[id="accountInfo.confirmPassword"]')).toBeFocused()

    await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('radio', { name: /Self/i })).toBeVisible()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page)

    await page.getByRole('radio', { name: /Self/i }).check()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('button', { name: /Add Recipient/i })).toBeVisible()

    await page.getByRole('button', { name: 'Add Recipient' }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.getByLabel('Recipient Email'))

    await page.getByLabel('Recipient Email').fill('self-recipient@example.com')

    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByRole('radio', { name: /Self/i })).toBeVisible()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('button', { name: /Add Recipient/i })).toBeVisible()
    await expect(page.getByLabel('Recipient Email')).toHaveValue('self-recipient@example.com')

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()

    await page.getByRole('button', { name: 'Add Medication' }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expectValidationError(page, page.locator('[id="medications[0].medicationName"]'))

    await page.locator('[id="medications[0].medicationName"]').fill('Suboxone')
    await page.getByLabel('Buprenorphine').check()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('checkbox', { name: /agree to the terms/i })).toBeVisible()
    await page.getByRole('button', { name: 'Complete Registration' }).click()
    await expectValidationError(page)
  },
)

test('supports employer preset referral with additional recipient', async ({ page }) => {
  await goToRecipients(page, 'employer', 'employer-preset')

  await page.locator('#employer-select').selectOption('employer-1')
  await expect(page.getByText('hr@acme.example')).toBeVisible()

  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByLabel('Recipient Email').fill('employee-personal@example.com')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()
})

test('supports employer new referral with preset and personal additional recipients', async ({ page }) => {
  await goToRecipients(page, 'employer', 'employer-new')

  await page.locator('#employer-select').selectOption('other')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expectValidationError(page, page.getByLabel('Employer Name'))
  await expectValidationError(page, page.getByLabel('Contact Email'))

  await page.getByLabel('Employer Name').fill('Summit Manufacturing')
  await page.getByLabel('Contact Email').fill('contact@summit.example')

  const addRecipientButtons = page.getByRole('button', { name: 'Add Recipient' })
  await expect(addRecipientButtons).toHaveCount(2)

  await addRecipientButtons.first().click()
  await page.getByLabel('Recipient Email').first().fill('manager@summit.example')

  await addRecipientButtons.nth(1).click()
  await page.getByLabel('Recipient Email').nth(1).fill('self-extra@example.com')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()
})

test('supports court preset referral with additional recipient', async ({ page }) => {
  await goToRecipients(page, 'court', 'court-preset')

  await page.getByLabel('Select Court').click()
  await page.getByRole('option', { name: 'Wayne County Court', exact: true }).click()
  await expect(page.getByText('probation@waynecourt.example')).toBeVisible()

  await page.getByRole('button', { name: 'Add Recipient' }).click()
  await page.getByLabel('Recipient Email').fill('court-self-extra@example.com')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()
})

test('supports court new referral with preset and personal additional recipients', async ({ page }) => {
  await goToRecipients(page, 'court', 'court-new')

  await page.getByLabel('Select Court').click()
  await page.getByRole('option', { name: 'Other (Add new court)', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expectValidationError(page, page.getByLabel('Court Name'))
  await expectValidationError(page, page.getByLabel('Contact Email'))

  await page.getByLabel('Court Name').fill('Lakeside District Court')
  await page.getByLabel('Contact Email').fill('clerk@lakesidecourt.example')

  const addRecipientButtons = page.getByRole('button', { name: 'Add Recipient' })
  await expect(addRecipientButtons).toHaveCount(2)

  await addRecipientButtons.first().click()
  await page.getByLabel('Recipient Email').first().fill('probation@lakesidecourt.example')

  await addRecipientButtons.nth(1).click()
  await page.getByLabel('Recipient Email').nth(1).fill('self-court-extra@example.com')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()
})

test(
  'submits frontend registration, signs in, and verifies admin emails in Mailpit',
  { tag: '@smoke' },
  async ({ page }) => {
    const env = getE2EEnv({ requirePdfs: false })
    await ensureMailpitReachable(env.mailpitApiBase)

    const registrationEmail = uniqueEmail('frontend-submit')
    const testStart = new Date()

    await openRegistration(page)
    await fillPersonalInfo(page)
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByLabel('Email Address')).toBeVisible()
    await page.getByLabel('Email Address').fill(registrationEmail)
    await page.locator('[id="accountInfo.password"]').fill('StrongPass123')
    await page.locator('[id="accountInfo.confirmPassword"]').fill('StrongPass123')
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('radio', { name: /Self/i })).toBeVisible()
    await page.getByRole('radio', { name: /Self/i }).check()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('button', { name: /Add Recipient/i })).toBeVisible()
    await page.getByRole('button', { name: 'Add Recipient' }).click()
    await page.getByLabel('Recipient Email').fill(`self.extra.${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('button', { name: /Add Medication/i })).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(page.getByRole('checkbox', { name: /agree to the terms/i })).toBeVisible()
    await page.getByLabel(/I have read and agree to the terms and conditions of service/i).check()

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
      page.getByRole('button', { name: 'Complete Registration' }).click(),
    ])
    await expect(page.getByRole('heading', { name: /Welcome back, Alex Taylor/i })).toBeVisible({ timeout: 30_000 })

    createdClientEmails.push(registrationEmail)

    const createdClient = await findClientByEmail(registrationEmail)
    expect(createdClient).not.toBeNull()
    expect(createdClient?.dob).toBeTruthy()
    expect(createdClient?.dob).toContain('1990-01-15')

    await findMailpitMessages({
      apiBase: env.mailpitApiBase,
      createdAfter: testStart,
      to: 'mike@midrugtest.com',
      subject: /^(?:\[TEST MODE\] )?New Client Registration - Alex Taylor$/,
      requireAttachment: 'none',
      timeoutMs: 30_000,
    })
  },
)
