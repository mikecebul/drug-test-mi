import { runDbOp } from './db-process'

export async function findClientByEmail(email: string) {
  return runDbOp<any | null>('find-client-by-email', { email })
}

export async function deleteClientAndRelatedDataByEmail(email: string) {
  return runDbOp<{ deleted: boolean }>('delete-client-by-email', { email })
}

export async function findLatestDrugTestForClient(clientId: string) {
  return runDbOp<any | null>('find-latest-drug-test-for-client', { clientId })
}

export async function getDrugTestById(testId: string) {
  return runDbOp<any>('get-drug-test-by-id', { testId })
}

export async function assertNotificationSent(args: {
  testId: string
  stage: 'collected' | 'screened' | 'complete'
  expectedIntendedEmails?: string[]
}) {
  return runDbOp<any>('assert-notification-sent', args)
}
