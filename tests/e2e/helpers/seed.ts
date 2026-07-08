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
    adminAlertIds?: string[]
    bookingIds?: string[]
    employerIds: string[]
    courtIds: string[]
    clientIds: string[]
    drugTestIds: string[]
    privateMediaIds: string[]
  }
}

export type GuidedScheduleFixtures = {
  bookings: {
    paidLinked: {
      id: string
      attendeeName: string
      startTime: string
    }
    unlinked: {
      id: string
      attendeeName: string
      startTime: string
    }
    needsTestType: {
      id: string
      attendeeName: string
      startTime: string
    }
    outsideToday: {
      id: string
      attendeeName: string
      startTime: string
    }
    cancelledToday: {
      id: string
      attendeeName: string
      startTime: string
    }
  }
}

export async function seedFixtures(): Promise<FixtureContext> {
  return runDbOp<FixtureContext>('seed-fixtures')
}

export async function seedGuidedScheduleFixtures(ctx: FixtureContext): Promise<GuidedScheduleFixtures> {
  return runDbOp<GuidedScheduleFixtures>('seed-guided-schedule-fixtures', ctx)
}
