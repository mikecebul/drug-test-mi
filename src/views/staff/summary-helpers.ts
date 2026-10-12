import type { Client, DrugTest } from '@/payload-types'
import { getResultPresentation } from '@/views/DrugTestWizard/components/result-presentation'
import { buildDrugTestSummaryState } from '@/collections/DrugTests/views/summaryState'

export const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export function clientName(client: Pick<Client, 'firstName' | 'middleInitial' | 'lastName'>) {
  return [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')
}
export function headshotUrl(client: Pick<Client, 'headshot'>) {
  return client.headshot && typeof client.headshot === 'object'
    ? client.headshot.thumbnailURL || client.headshot.url || undefined
    : undefined
}
export function historyResult(test: DrugTest) {
  const summary = buildDrugTestSummaryState(test)
  const result =
    summary.result.key === 'pending'
      ? { label: 'Result not available yet', variant: 'warning' as const }
      : summary.result.key === 'confirmed-negative'
        ? { label: 'Confirmed negative', variant: 'success' as const }
        : summary.result.key === 'inconclusive'
          ? { label: 'Inconclusive', variant: 'warning' as const }
          : getResultPresentation(summary.result.key)
  return { ...result, status: summary.workflowStage.label, report: test.confirmationDocument || test.testDocument }
}
export { clientBalances } from '@/collections/Payments/services/clientBalances'
