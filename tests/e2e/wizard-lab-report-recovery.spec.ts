import { expect, test, type Page } from '@playwright/test'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { getPayloadClient } from './helpers/payload'
import { getDrugTestById, assertNotificationSent } from './helpers/db-assert'
import {
  clickBack,
  clickNext,
  expectWizardStep,
  extractTestIdFromSuccess,
  selectWorkflow,
  selectLabCollection,
} from './helpers/wizard'
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
  await expect(page.getByTestId('parsed-report')).toBeVisible()
  await expectWizardStep(page, 'upload')
}
async function match(page: Page, testId: string, _legacyStep: string) {
  await clickNext(page)
  await expectWizardStep(page, 'match')
  await selectLabCollection(page, testId)
  await expect(page.getByTestId('lab-client-context')).toBeVisible()
  const identity = page.getByTestId('lab-report-identity-confirmation')
  if (await identity.isVisible()) await identity.check()
  await clickNext(page)
  await expectWizardStep(page, 'results')
}
async function choose(page: Page, index: number, result: 'Confirmed Negative' | 'Confirmed Positive') {
  await page.getByTestId(`confirmation-review-${index}`).click()
  await page.locator(`#result-${index}`).click()
  await page.getByRole('option', { name: result, exact: true }).click()
  await page.getByRole('button', { name: 'Use result', exact: true }).click()
}
async function finish(page: Page) {
  await clickNext(page)
  await expectWizardStep(page, 'review')
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
    await expect(page.getByTestId('confirmation-row-1')).toContainText('THC')
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
    expect((await getDrugTestById(fixtures.tests.labConfirmPendingTestId)).screeningStatus).not.toBe('complete')
    await choose(page, 1, 'Confirmed Negative')
    await clickNext(page)
    await expectWizardStep(page, 'review')
    await clickBack(page)
    await expectWizardStep(page, 'results')
    await expect(page.getByTestId('confirmation-row-1')).toContainText('Negative')
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
    await expect(page.getByTestId('confirmation-row-0')).toContainText('Positive')
    await clickBack(page)
    await expectWizardStep(page, 'match')
    await clickBack(page)
    await expectWizardStep(page, 'upload')
    await page.getByRole('listitem').filter({ hasText: 'first.pdf' }).getByRole('button').click()
    await upload(page, pdf(confirmation(475, 'Fentanyl', '<100 ng/mL')), 'replacement.pdf')
    await extract(page)
    await match(page, fixtures.tests.labConfirmPendingTestId, 'labConfirmationData')
    await expect(page.getByTestId('confirmation-row-0')).toContainText('Check result')
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
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
    await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
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
    await match(page, fixtures.tests.labConfirmPendingTestId, 'confirmation')
    await expect(page.getByTestId('parsed-screening-results')).toHaveCount(0)
    await expect(page.getByTestId('confirmation-row-0')).toContainText('Positive')
  },
)

test('a failed replacement cannot reuse earlier extraction readiness', { tag: '@critical' }, async ({ page }) => {
  await selectWorkflow(page, 'Enter Lab Confirmation Data')
  await upload(page, pdf(confirmation(475, 'Fentanyl', 'Negative')), 'first.pdf')
  await extract(page)
  await expectWizardStep(page, 'upload')
  await page.getByRole('listitem').filter({ hasText: 'first.pdf' }).getByRole('button').click()
  await upload(page, Buffer.from('Not a valid PDF'), 'broken.pdf')
  await expect(page.getByRole('alert').filter({ hasText: /PDF/ })).toBeVisible()
  await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
  await expectWizardStep(page, 'upload')
})
