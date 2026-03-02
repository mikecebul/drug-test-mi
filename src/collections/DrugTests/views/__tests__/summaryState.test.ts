import { describe, expect, test } from 'vitest'

import { buildDrugTestSummaryState, type DrugTestSummaryInput } from '../summaryState'

function makeTest(overrides: DrugTestSummaryInput = {}): DrugTestSummaryInput {
  return {
    screeningStatus: 'collected',
    testType: '11-panel-lab',
    relatedClient: 'client-1',
    ...overrides,
  }
}

describe('buildDrugTestSummaryState', () => {
  test('collected lab test returns await-lab next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'collected',
        testType: '11-panel-lab',
      }),
    )

    expect(summary.nextStep).toBe(
      'Await lab report, then upload the screening document to move this test to screened.',
    )
  })

  test('collected instant test returns enter-screening next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'collected',
        testType: '15-panel-instant',
      }),
    )

    expect(summary.nextStep).toBe(
      'Enter initial screening findings and save to compute result classification.',
    )
  })

  test('screened unexpected-positive without decision returns decision next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'screened',
        testType: '15-panel-instant',
        initialScreenResult: 'unexpected-positive',
        confirmationDecision: null,
      }),
    )

    expect(summary.workflowStage.id).toBe('awaiting-decision')
    expect(summary.nextStep).toBe(
      'Record confirmation decision: accept current results or request confirmation testing.',
    )
  })

  test('request-confirmation with incomplete results returns remaining-confirmation next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'confirmation-pending',
        initialScreenResult: 'unexpected-positive',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc', 'cocaine'],
        confirmationResults: [{ substance: 'thc', result: 'confirmed-positive' }],
      }),
    )

    expect(summary.confirmationProgress.isComplete).toBe(false)
    expect(summary.nextStep).toBe(
      'Enter remaining confirmation outcomes and upload confirmation report when available.',
    )
  })

  test('complete accepted test returns no-additional-action next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'complete',
        isComplete: true,
        initialScreenResult: 'negative',
        confirmationDecision: 'accept',
      }),
    )

    expect(summary.workflowStage.id).toBe('complete')
    expect(summary.nextStep).toBe(
      'No additional workflow action required; verify notification history is complete.',
    )
  })

  test('inconclusive complete test returns schedule-new-collection next step', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'complete',
        isComplete: true,
        isInconclusive: true,
        finalStatus: 'inconclusive',
      }),
    )

    expect(summary.workflowStage.id).toBe('invalid-sample')
    expect(summary.nextStep).toBe(
      'Sample marked invalid; schedule a new collection and keep this record as completed inconclusive.',
    )
  })

  test('request-confirmation with no substances adds blocking flag', () => {
    const summary = buildDrugTestSummaryState(
      makeTest({
        screeningStatus: 'confirmation-pending',
        initialScreenResult: 'unexpected-positive',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: [],
        confirmationResults: [],
      }),
    )

    expect(summary.nextStep).toBe(
      'Select substances for confirmation so the lab confirmation request can proceed.',
    )
    expect(summary.blockingFlags).toContain(
      'Confirmation testing was requested, but no substances are selected.',
    )
  })
})
