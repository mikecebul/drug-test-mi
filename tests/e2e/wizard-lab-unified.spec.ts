import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { seedFixtures, type FixtureContext } from './helpers/seed'
import { cleanupFixtures } from './helpers/cleanup'
import { loginAdmin } from './helpers/auth'
import { clickNext, expectWizardStep, confirmLabIdentity, extractTestIdFromSuccess } from './helpers/wizard'
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
      await page.getByTestId(`pending-test-${testId}`).click()
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
