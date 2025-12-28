'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

export interface DashboardStats {
  totalClients: number
  totalDrugTests: number
  incompleteDrugTests: number
  pendingConfirmation: number
  unresolvedAlerts: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const payload = await getPayload({ config })

  const [clients, drugTests, incomplete, pending, alerts] = await Promise.all([
    payload.count({ collection: 'clients' }),
    payload.count({ collection: 'drug-tests' }),
    payload.count({
      collection: 'drug-tests',
      where: { isComplete: { equals: false } },
    }),
    payload.count({
      collection: 'drug-tests',
      where: {
        and: [
          { confirmationDecision: { equals: 'request-confirmation' } },
          { isComplete: { equals: false } },
        ],
      },
    }),
    payload.count({
      collection: 'admin-alerts',
      where: { resolved: { equals: false } },
    }),
  ])

  return {
    totalClients: clients.totalDocs,
    totalDrugTests: drugTests.totalDocs,
    incompleteDrugTests: incomplete.totalDocs,
    pendingConfirmation: pending.totalDocs,
    unresolvedAlerts: alerts.totalDocs,
  }
}
