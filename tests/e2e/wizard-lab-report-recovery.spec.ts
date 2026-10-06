import { expect, test, type Page } from '@playwright/test'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { getPayloadClient } from './helpers/payload'
import { getDrugTestById, assertNotificationSent } from './helpers/db-assert'
import { clickBack, clickNext, expectWizardStep, extractTestIdFromSuccess, selectWorkflow } from './helpers/wizard'
import { makeReportPdf, type Cell } from '../../src/utilities/extractors/__tests__/helpers/reportPdf'

const cell = (y: number, values: [number, string][]): Cell[] => values.map(([x, text]) => ({ x, y, text }))
const identity = [
  ...cell(760, [[40, 'B729 - Urine 11 Panel']]),
  ...cell(740, [
    [40, 'Identification:'],
    [160, 'Sample Q Donor'],
  ]),
  ...cell(720, [
    [40, 'Collected:'],
    [160, '11/19/2025 06:17 PM'],
  ]),
  ...cell(700, [
    [40, 'DOB:'],
    [160, '01/15/1990'],
  ]),
]
const headings = cell(500, [
  [40, 'Drug Class'],
  [236, 'Method'],
  [276, 'Cutoff'],
  [323, 'Result'],
  [401, 'Method'],
  [441, 'Cutoff'],
  [488, 'Result'],
])
const confirmation = (y: number, label: string, result: string) =>
  cell(y, [
    [40, label],
    [401, 'LC/MS/MS'],
    [441, '5 ng/mL'],
    [488, result],
  ])
const screening = [
  'Amphetamines 500',
  'Benzodiazepines',
  'Buprenorphine',
  'Cocaine',
  'EtG',
  'Fentanyl',
  'Mitragynine',
  'Methadone',
  'Opiates',
  'THC',
].flatMap((label, index) =>
  cell(475 - index * 22, [
    [40, label],
    [236, 'EIA'],
    [276, '5 ng/mL'],
    [323, label === 'Fentanyl' ? 'Screened Positive' : 'Negative'],
  ]),
)
const pdf = (...rows: Cell[][]) => makeReportPdf([[...identity, ...headings, ...rows.flat()]])
let fixtures: FixtureContext

test.beforeEach(async ({ page }) => {
  fixtures = await seedFixtures()
  await loginAdmin(page, fixtures.admin)
})
test.afterEach(async () => cleanupFixtures(fixtures))

async function upload(page: Page, buffer: Buffer, name = 'report.pdf') {
  await page
    .locator('[data-slot="file-upload"] input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: 'application/pdf', buffer })
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
}
async function extract(page: Page) {
  await clickNext(page)
  await expectWizardStep(page, 'extract')
  await expect(page.getByTestId('parsed-report')).toBeVisible()
}
async function match(page: Page, testId: string, step: 'labConfirmationData' | 'labScreenData') {
  await clickNext(page)
  await expectWizardStep(page, 'matchCollection')
  await page.getByTestId(`pending-test-${testId}`).click()
  await clickNext(page)
  await expectWizardStep(page, step)
}
async function choose(page: Page, index: number, result: 'Confirmed Negative' | 'Confirmed Positive') {
  await page.locator(`#result-${index}`).click()
  await page.getByRole('option', { name: result, exact: true }).click()
  await expect(page.locator(`#result-${index}`)).toContainText(result)
}
async function finish(page: Page) {
  await clickNext(page)
  await expectWizardStep(page, 'confirm')
  await clickNext(page)
  await expectWizardStep(page, 'emails')
  await page.getByTestId('wizard-next-button').click()
  return extractTestIdFromSuccess(page)
}

test(
  'requires every requested confirmation, keeps corrections across Back, and preserves the request on save',
  { tag: '@critical' },
  async ({ page }) => {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'drug-tests',
      id: fixtures.tests.labConfirmPendingTestId,
      data: {
        detectedSubstances: ['fentanyl', 'thc'],
        confirmationSubstances: ['fentanyl', 'thc'],
        confirmationDecision: 'request-confirmation',
      },
      overrideAccess: true,
    })
    await selectWorkflow(page, 'Enter Lab Confirmation Data')
    await upload(page, pdf(confirmation(475, 'Fentanyl', 'Negative'), confirmation(445, 'THC', '<100 ng/mL')))
    await extract(page)
    await match(page, fixtures.tests.labConfirmPendingTestId, 'labConfirmationData')
    await expect(page.locator('#substance-1')).toContainText('THC')
    await clickNext(page)
    await expectWizardStep(page, 'labConfirmationData')
    await expect(page.locator('#result-1')).toHaveAttribute('aria-invalid', 'true')
    expect((await getDrugTestById(fixtures.tests.labConfirmPendingTestId)).screeningStatus).not.toBe('complete')
    await choose(page, 1, 'Confirmed Negative')
    await clickNext(page)
    await expectWizardStep(page, 'confirm')
    await clickBack(page)
    await expectWizardStep(page, 'labConfirmationData')
    await expect(page.locator('#result-1')).toContainText('Confirmed Negative')
    const testId = await finish(page)
    const record = await assertNotificationSent({ testId, stage: 'complete' })
    expect(record.confirmationSubstances).toEqual(['fentanyl', 'thc'])
    expect(
      record.confirmationResults.map((row: { substance: string; result: string }) => [row.substance, row.result]),
    ).toEqual([
      ['fentanyl', 'confirmed-negative'],
      ['thc', 'confirmed-negative'],
    ])
  },
)

test(
  'replacing a report clears earlier confirmations and forces a new result selection',
  { tag: '@critical' },
  async ({ page }) => {
    await selectWorkflow(page, 'Enter Lab Confirmation Data')
    await upload(page, pdf(confirmation(475, 'Fentanyl', 'Confirmed Positive')), 'first.pdf')
    await extract(page)
    await match(page, fixtures.tests.labConfirmPendingTestId, 'labConfirmationData')
    await expect(page.locator('#result-0')).toContainText('Confirmed Positive')
    await clickBack(page)
    await expectWizardStep(page, 'matchCollection')
    await clickBack(page)
    await expectWizardStep(page, 'extract')
    await clickBack(page)
    await expect(page.getByRole('heading', { name: 'Upload Confirmation PDF' })).toBeVisible()
    await page.getByRole('listitem').filter({ hasText: 'first.pdf' }).getByRole('button').click()
    await upload(page, pdf(confirmation(475, 'Fentanyl', '<100 ng/mL')), 'replacement.pdf')
    await extract(page)
    await match(page, fixtures.tests.labConfirmPendingTestId, 'labConfirmationData')
    await expect(page.locator('#result-0')).not.toContainText('Confirmed Positive')
    await clickNext(page)
    await expectWizardStep(page, 'labConfirmationData')
    await expect(page.locator('#result-0')).toHaveAttribute('aria-invalid', 'true')
  },
)

test(
  'a first combined report can be corrected and saved in the screening workflow',
  { tag: '@critical' },
  async ({ page }) => {
    await selectWorkflow(page, 'Enter Lab Screen Data')
    await upload(page, pdf(screening, confirmation(240, 'Fentanyl', '<100 ng/mL')))
    await extract(page)
    await match(page, fixtures.tests.labScreenCollectedTestId, 'labScreenData')
    await expect(page.getByTestId('confirmation-results-editor')).toBeVisible()
    await clickNext(page)
    await expectWizardStep(page, 'labScreenData')
    await choose(page, 0, 'Confirmed Negative')
    const testId = await finish(page)
    expect(testId).toBe(fixtures.tests.labScreenCollectedTestId)
    const record = await assertNotificationSent({ testId, stage: 'screened' })
    expect(record.testDocument).toBeTruthy()
    expect(record.confirmationResults).toEqual([
      expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' }),
    ])
    expect(record.screeningStatus).toBe('complete')
  },
)

test(
  'a positive confirmation-only report does not display a negative screening status',
  { tag: '@critical' },
  async ({ page }) => {
    await selectWorkflow(page, 'Enter Lab Confirmation Data')
    await upload(page, pdf(confirmation(475, 'Fentanyl', 'Confirmed Positive')))
    await extract(page)
    await expect(page.getByTestId('parsed-screening-results')).toHaveCount(0)
    await expect(page.getByTestId('parsed-report').getByText('Confirmed Positive', { exact: true })).toBeVisible()
  },
)

test('a failed replacement cannot reuse earlier extraction readiness', { tag: '@critical' }, async ({ page }) => {
  await selectWorkflow(page, 'Enter Lab Confirmation Data')
  await upload(page, pdf(confirmation(475, 'Fentanyl', 'Negative')), 'first.pdf')
  await extract(page)
  await clickBack(page)
  await expect(page.getByRole('heading', { name: 'Upload Confirmation PDF' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'first.pdf' }).getByRole('button').click()
  await upload(page, Buffer.from('Not a valid PDF'), 'broken.pdf')
  await clickNext(page)
  await expectWizardStep(page, 'extract')
  await expect(page.getByRole('heading', { name: 'Extraction Error' })).toBeVisible()
  await page.getByTestId('wizard-next-button').click()
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible()
  await expectWizardStep(page, 'extract')
})
