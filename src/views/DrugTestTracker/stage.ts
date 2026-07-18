export type TrackerStageTest = {
  isComplete: boolean
  initialScreenResult?: string
  confirmationDecision?: string
  confirmationResults?: Array<{ result?: string }>
  confirmationSubstances?: string[]
  payment?: {
    status?: string | null
    balanceDue?: number | null
    confirmationFeeDue?: number | null
    confirmationPaymentBypassed?: boolean | null
  }
}

export function getBalanceDue(test: TrackerStageTest) {
  return typeof test.payment?.balanceDue === 'number' ? Math.max(0, test.payment.balanceDue) : 0
}

export function getTestStage(test: TrackerStageTest) {
  // An unpaid balance is an old-balance action only after the test workflow is complete.
  // Collected tests that are still processing remain in their operational tracker stage.
  if (test.isComplete && getBalanceDue(test) > 0) {
    return { stage: 'Payment Due', color: 'bg-red-500', priority: 1 }
  }

  if (!test.initialScreenResult) {
    return { stage: 'Awaiting Results', color: 'bg-gray-500', priority: 2 }
  }

  if (['negative', 'inconclusive'].includes(test.initialScreenResult)) {
    return test.isComplete
      ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
      : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
  }

  if (
    [
      'expected-positive',
      'unexpected-positive',
      'mixed-unexpected',
      'unexpected-negative-critical',
      'unexpected-negative-warning',
    ].includes(test.initialScreenResult)
  ) {
    if (!test.confirmationDecision || test.confirmationDecision === 'pending-decision') {
      return { stage: 'Awaiting Client Decision', color: 'bg-orange-500', priority: 3 }
    }

    if (test.confirmationDecision === 'accept') {
      return test.isComplete
        ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
        : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
    }

    if (test.confirmationDecision === 'request-confirmation') {
      if (getBalanceDue(test) > 0 && test.payment?.confirmationFeeDue && !test.payment.confirmationPaymentBypassed) {
        return { stage: 'Awaiting Confirmation Payment', color: 'bg-red-500', priority: 3 }
      }

      const hasAllResults =
        test.confirmationResults &&
        test.confirmationSubstances &&
        test.confirmationResults.length === test.confirmationSubstances.length &&
        test.confirmationResults.every((result) => result.result)

      if (!hasAllResults) {
        return { stage: 'Pending Confirmation', color: 'bg-yellow-500', priority: 4 }
      }

      return test.isComplete
        ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
        : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
    }
  }

  return { stage: 'Unknown', color: 'bg-gray-500', priority: 0 }
}

export function shouldStayInTracker(test: TrackerStageTest) {
  return !test.isComplete || getBalanceDue(test) > 0
}
