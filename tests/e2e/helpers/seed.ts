import { runDbOp } from './db-process'

export type SeededPerson = {
  id: string
  firstName: string
  middleInitial?: string
  lastName: string
  fullName: string
  email: string
  referralRecipients: string[]
}

export type FixtureContext = {
  runId: string
  admin: {
    id: string
    email: string
    password: string
    name: string
  }
  referrals: {
    employer: {
      id: string
      name: string
      recipientEmail: string
    }
    court: {
      id: string
      name: string
      recipientEmail: string
    }
  }
  clients: {
    collectLab: SeededPerson
    instant: SeededPerson
    labScreen: SeededPerson
    labConfirm: SeededPerson
  }
  tests: {
    labScreenCollectedTestId: string
    labConfirmPendingTestId: string
  }
  created: {
    adminIds: string[]
    employerIds: string[]
    courtIds: string[]
    clientIds: string[]
    drugTestIds: string[]
    privateMediaIds: string[]
  }
}

export async function seedFixtures(): Promise<FixtureContext> {
  return runDbOp<FixtureContext>('seed-fixtures')
}
