import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import {
  clickNext,
  expectWizardStep,
  confirmLabIdentity,
  extractTestIdFromSuccess,
  selectLabCollection,
} from './helpers/wizard'
import { getPayloadClient } from './helpers/payload'
import { getE2EEnv } from './helpers/env'
import { getDrugTestById, assertNotificationSent } from './helpers/db-assert'
import { makeReportPdf } from '../../src/utilities/extractors/__tests__/helpers/reportPdf'

let fixtures: FixtureContext
test.beforeEach(async ({ page }) => {
  fixtures = await seedFixtures()
  await loginAdmin(page, fixtures.admin)
})
test.afterEach(async () => cleanupFixtures(fixtures))
const confirmationOnly = () =>
  makeReportPdf([
    [
      { x: 40, y: 760, text: 'B729 - Urine 11 Panel' },
      { x: 40, y: 740, text: 'Identification:' },
      { x: 160, y: 740, text: 'Sample Q Donor' },
      { x: 40, y: 720, text: 'Collected:' },
      { x: 160, y: 720, text: '11/19/2025 06:17 PM' },
      { x: 40, y: 700, text: 'DOB:' },
      { x: 160, y: 700, text: '01/15/1990' },
      { x: 40, y: 500, text: 'Drug Class' },
      { x: 240, y: 500, text: 'Method' },
      { x: 350, y: 500, text: 'Cutoff' },
      { x: 470, y: 500, text: 'Result' },
      { x: 40, y: 475, text: 'Fentanyl' },
      { x: 240, y: 475, text: 'LC/MS/MS' },
      { x: 350, y: 475, text: '5 ng/mL' },
      { x: 470, y: 475, text: 'Negative' },
    ],
  ])
for (const kind of ['screening', 'confirmation', 'combined-collected', 'combined-pending'] as const) {
  test(
    `one Lab results entry detects ${kind} and saves the correct collection stage`,
    { tag: '@critical' },
    async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      const env = getE2EEnv()
      const isConfirmation = kind === 'confirmation' || kind === 'combined-pending'
      const testId = isConfirmation ? fixtures.tests.labConfirmPendingTestId : fixtures.tests.labScreenCollectedTestId
      const before = await getDrugTestById(testId)
      await expect(page.getByTestId('workflow-option-lab-results')).toHaveCount(1)
      await expect(page.getByTestId('workflow-option-enter-lab-screen')).toHaveCount(0)
      await expect(page.getByTestId('workflow-option-enter-lab-confirmation')).toHaveCount(0)
      await page.getByTestId('workflow-option-lab-results').click()
      await expectWizardStep(page, 'upload')
      const buffer =
        kind === 'confirmation'
          ? confirmationOnly()
          : await readFile(kind === 'screening' ? env.pdfLabScreenPath : env.pdfLabConfirmPath)
      await page
        .locator('[data-slot="file-upload"] input[type="file"]')
        .first()
        .setInputFiles({ name: 'lab-report.pdf', mimeType: 'application/pdf', buffer })
      await expect(page.getByTestId('parsed-report')).toBeVisible()
      await clickNext(page)
      await expectWizardStep(page, 'match')
      await selectLabCollection(page, testId)
      await confirmLabIdentity(page)
      if (kind === 'screening') await page.screenshot({ path: test.info().outputPath('lab-match.png'), fullPage: true })
      await clickNext(page)
      await expectWizardStep(page, 'results')
      if (kind === 'screening') await expect(page.getByTestId('confirmation-results-editor')).toHaveCount(0)
      else await expect(page.getByTestId('confirmation-row-0')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Edit test details', exact: true })).toHaveCount(
        isConfirmation ? 0 : 1,
      )
      if (kind === 'screening' || kind === 'confirmation')
        await page.screenshot({ path: test.info().outputPath(`lab-${kind}-results.png`), fullPage: true })
      await clickNext(page)
      await expectWizardStep(page, 'review')
      if (kind === 'screening')
        await page.screenshot({ path: test.info().outputPath('lab-review.png'), fullPage: true })
      await page.getByTestId('wizard-next-button').click()
      expect(await extractTestIdFromSuccess(page)).toBe(testId)
      const record = await assertNotificationSent({ testId, stage: isConfirmation ? 'complete' : 'screened' })
      expect(record.medicationsArrayAtTestTime).toEqual(before.medicationsArrayAtTestTime)
      if (isConfirmation) {
        expect(record.detectedSubstances).toEqual(before.detectedSubstances)
        expect(record.isDilute).toBe(before.isDilute)
        expect(record.confirmationSubstances).toEqual(before.confirmationSubstances)
      }
      if (kind !== 'screening')
        expect(record.confirmationResults).toEqual([
          expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' }),
        ])
    },
  )
}

test('collection choices pin the match, hide alternatives, and retain a newly chosen collection when collapsed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  const payload = await getPayloadClient()
  const extra: string[] = []
  for (const [clientId, collectionDate] of [
    [fixtures.clients.collectLab.id, '2026-05-23T12:00:00Z'],
    [fixtures.clients.instant.id, '2026-05-24T12:00:00Z'],
    [fixtures.clients.labScreen.id, '2025-12-01T12:00:00Z'],
    [fixtures.clients.labScreen.id, '2026-02-01T12:00:00Z'],
  ]) {
    const record = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: clientId,
        collectionDate,
        testType: '11-panel-lab',
        screeningStatus: 'collected',
        payment: { status: 'unpaid', amountDue: 0, amountPaid: 0, balanceDue: 0 },
      },
      overrideAccess: true,
    })
    fixtures.created.drugTestIds.push(record.id)
    extra.push(record.id)
  }
  const selectedId = fixtures.tests.labScreenCollectedTestId
  const buffer = makeReportPdf([
    [
      { x: 40, y: 760, text: 'B729 - Urine 11 Panel' },
      { x: 40, y: 740, text: 'Identification:' },
      { x: 160, y: 740, text: fixtures.clients.labScreen.fullName },
      { x: 40, y: 720, text: 'Collected:' },
      { x: 160, y: 720, text: '01/07/2026 11:11 PM' },
      { x: 40, y: 700, text: 'DOB:' },
      { x: 160, y: 700, text: '01/14/1990' },
      { x: 40, y: 500, text: 'Drug Class' },
      { x: 240, y: 500, text: 'Method' },
      { x: 350, y: 500, text: 'Cutoff' },
      { x: 470, y: 500, text: 'Result' },
      ...[
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
      ].flatMap((text, i) => [
        { x: 40, y: 475 - i * 22, text },
        { x: 240, y: 475 - i * 22, text: 'EIA' },
        { x: 350, y: 475 - i * 22, text: '5 ng/mL' },
        { x: 470, y: 475 - i * 22, text: 'Negative' },
      ]),
    ],
  ])
  await page.getByTestId('workflow-option-lab-results').click()
  await page
    .locator('[data-slot="file-upload"] input[type="file"]')
    .first()
    .setInputFiles({ name: 'match.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.getByTestId('parsed-report')).toBeVisible()
  await clickNext(page)
  await expectWizardStep(page, 'match')
  const progress = page.getByRole('navigation', { name: 'Lab result steps' })
  await expect(progress.getByRole('listitem')).toHaveCount(4)
  await expect(progress.locator('[aria-current="step"]')).toHaveCount(1)
  const choices = page.getByTestId('lab-collection-choices').locator('button')
  await expect(choices).toHaveCount(3)
  await expect(choices.first()).toHaveAttribute('data-testid', `pending-test-${selectedId}`)
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true')
  const clientName = new RegExp(
    fixtures.clients.labScreen.fullName
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s.]+'),
    'i',
  )
  await expect(choices.first()).toContainText(clientName)
  await expect(choices.first()).toContainText('Jan 7, 2026')
  await expect(choices.first()).toContainText('11:11 PM')
  await expect(choices.first()).not.toContainText('11:11:00')
  await expect(page.locator('#lab-report-type')).toBeVisible()
  await page.locator('#lab-report-type').click()
  await expect(page.getByRole('option')).toHaveCount(3)
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('wizard-next-button')).toBeDisabled()
  await expect(page.getByText('01/14/1990', { exact: true })).toBeVisible()
  await expect(page.getByTestId('identity-notice').getByTestId('lab-report-identity-confirmation')).toBeVisible()
  const clientCard = page.getByTestId('lab-client-context')
  await expect(clientCard.getByRole('button', { name: 'Change client', exact: true })).toBeVisible()
  const headshotButton = clientCard.getByTestId('add-headshot-button')
  await expect(headshotButton).toHaveCSS('cursor', 'pointer')
  await headshotButton.hover()
  await headshotButton.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
  })
  await page.screenshot({ path: test.info().outputPath('headshot-hover.png'), fullPage: true })
  await clientCard.getByTestId('add-headshot-button').click()
  await expect(
    page.getByRole('dialog', { name: 'Edit Client Details' }).getByRole('button', { name: 'Take Photo' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await clientCard.getByRole('button', { name: 'Change client', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Search and Select Client' })).toBeVisible()
  await page.keyboard.press('Escape')
  const more = page.getByTestId('lab-collection-more')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await page.screenshot({ path: test.info().outputPath('lab-match-simple-actual.png'), fullPage: true })
  await page.getByTestId('lab-report-identity-confirmation').check()
  await expect(page.getByTestId('wizard-next-button')).toBeEnabled()
  await more.click()
  await expect(choices).toHaveCount(5)
  expect(await choices.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))).toEqual(
    [selectedId, ...extra].map((id) => `pending-test-${id}`),
  )
  await selectLabCollection(page, extra[3])
  await more.click()
  await expect(choices).toHaveCount(3)
  await expect(choices.first()).toHaveAttribute('data-testid', `pending-test-${extra[3]}`)
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true')
})
