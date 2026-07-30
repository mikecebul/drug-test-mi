import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fetchUpcoming: vi.fn(),
  find: vi.fn(),
  getPayload: vi.fn(),
  getRandomTestingStart: vi.fn(),
  getValidatedRandomTestingCalcomEventType: vi.fn(),
  jobsQueue: vi.fn(),
  listGoogleEvents: vi.fn(),
  previewToday: vi.fn(),
  recordQueuedJobRun: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('payload', () => ({
  getPayload: mocks.getPayload,
}))
vi.mock('@/lib/jobs/jobRuns', () => ({
  recordQueuedJobRun: mocks.recordQueuedJobRun,
}))
vi.mock('@/lib/random-testing/calcom', () => ({
  getRandomTestingStart: mocks.getRandomTestingStart,
  getValidatedRandomTestingCalcomEventType: mocks.getValidatedRandomTestingCalcomEventType,
}))
vi.mock('@/lib/random-testing/todays-schedule', () => ({
  previewTodaysScheduledCollections: mocks.previewToday,
}))
vi.mock('@/lib/redwood/upcoming-scheduled-collections', () => ({
  fetchUpcomingScheduledCollections: mocks.fetchUpcoming,
}))
vi.mock('@/utilities/google-calendar-api', () => ({
  listGoogleCalendarEvents: mocks.listGoogleEvents,
}))

import { checkRandomTestingConnections, previewRandomTestingToday, queueRandomTestingSync } from './randomTestingSync'

describe('random-testing dashboard controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: { collection: 'admins', id: 'admin-1', role: 'superAdmin' },
    })
    mocks.getPayload.mockResolvedValue({
      auth: mocks.auth,
      find: mocks.find,
      jobs: { queue: mocks.jobsQueue },
    })
    vi.stubEnv('CAL_API_KEY', 'cal-key')
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'calendar-id')
    vi.stubEnv('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL', 'calendar@example.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY', 'private-key')
    vi.stubEnv('REDWOOD_PASSWORD', 'password')
    vi.stubEnv('REDWOOD_USERNAME', 'username')
    vi.stubEnv('RANDOM_TESTING_SCHEDULE_SYNC_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('checks ToxAccess, Cal.com, and Google Calendar without writing', async () => {
    mocks.fetchUpcoming.mockResolvedValue([
      { collectionDate: '2026-08-03', female: 1, male: 2, total: 3, unspecified: 0 },
    ])
    mocks.getRandomTestingStart.mockResolvedValue({
      start: '2026-08-03T22:00:00.000Z',
      end: '2026-08-03T22:10:00.000Z',
      timeZone: 'America/Detroit',
    })
    mocks.getValidatedRandomTestingCalcomEventType.mockResolvedValue({
      id: 3684719,
      lengthInMinutes: 10,
      price: 0,
      scheduleId: 840279,
    })
    mocks.listGoogleEvents.mockResolvedValue([])

    const result = await checkRandomTestingConnections()

    expect(result.success).toBe(true)
    expect(result.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ToxAccess', success: true, detail: expect.stringContaining('3 upcoming') }),
        expect.objectContaining({
          name: 'Cal.com',
          success: true,
          detail: expect.stringContaining('Event 3684719 is unpaid and 10 minutes on schedule 840279'),
        }),
        expect.objectContaining({ name: 'Google Calendar', success: true }),
      ]),
    )
    expect(mocks.jobsQueue).not.toHaveBeenCalled()
  })

  test('previews today with client matching status', async () => {
    mocks.previewToday.mockResolvedValue([
      {
        agency: 'MI Drug Test',
        clientId: 'client-1',
        collectionKey: '2026-07-29:donor-1',
        donorGroup: 'Random',
        donorId: 'donor-1',
        donorName: 'Example Donor',
        status: 'ready',
        testType: 'Random',
      },
    ])

    const result = await previewRandomTestingToday()

    expect(result.success).toBe(true)
    expect(result.collections?.[0]).toEqual(expect.objectContaining({ donorName: 'Example Donor', status: 'ready' }))
  })

  test('queues the production upcoming sync task and records it in job history', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    mocks.jobsQueue.mockResolvedValue({ id: 'job-123' })

    const result = await queueRandomTestingSync('upcoming')

    expect(result).toEqual({
      success: true,
      jobId: 'job-123',
      kind: 'upcoming',
    })
    expect(mocks.jobsQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-sync-upcoming-random-testing',
        queue: 'redwood',
      }),
    )
    expect(mocks.recordQueuedJobRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jobId: 'job-123',
        taskSlug: 'redwood-sync-upcoming-random-testing',
      }),
    )
  })

  test('queues an immediate dashboard run when a future scheduled run already exists', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 'scheduled-job',
          completedAt: null,
          hasError: false,
          input: {},
          waitUntil: '2026-08-03T10:05:00.000Z',
        },
      ],
    })
    mocks.jobsQueue.mockResolvedValue({ id: 'manual-job' })

    const result = await queueRandomTestingSync('upcoming')

    expect(result).toEqual({
      success: true,
      jobId: 'manual-job',
      kind: 'upcoming',
    })
    expect(mocks.jobsQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-sync-upcoming-random-testing',
        queue: 'redwood',
        input: expect.objectContaining({ source: 'admin-dashboard' }),
      }),
    )
  })

  test('deduplicates an active dashboard run of the same task', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 'manual-job',
          completedAt: null,
          hasError: false,
          input: {
            requestedByAdminId: 'admin-1',
            source: 'admin-dashboard',
          },
        },
      ],
    })

    const result = await queueRandomTestingSync('today')

    expect(result).toEqual({
      success: true,
      deduplicated: true,
      jobId: 'manual-job',
      kind: 'today',
    })
    expect(mocks.jobsQueue).not.toHaveBeenCalled()
  })

  test('does not queue calendar writes while the kill switch is disabled', async () => {
    vi.stubEnv('RANDOM_TESTING_SCHEDULE_SYNC_ENABLED', 'false')

    const result = await queueRandomTestingSync('today')

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true'),
    })
    expect(mocks.jobsQueue).not.toHaveBeenCalled()
  })
})
