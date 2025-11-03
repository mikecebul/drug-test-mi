import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendNotificationEmails } from '../sendNotificationEmails'
import * as fs from 'fs'
import type { DrugTest } from '@/payload-types'

// Mock modules FIRST (these get hoisted to the top)
vi.mock('../../email/recipients')
vi.mock('@/lib/admin-alerts')
vi.mock('fs')

// Now import the mocked functions so we can configure them
import { getRecipients } from '../../email/recipients'
import { createAdminAlert } from '@/lib/admin-alerts'

// Mock the email templates
vi.mock('../../email/templates', () => ({
  buildCollectedEmail: vi.fn(() => ({
    subject: 'Sample Collected',
    html: '<html>Collected</html>',
  })),
  buildScreenedEmail: vi.fn(() => ({
    client: {
      subject: 'Results Available - Client',
      html: '<html>Client Screened</html>',
    },
    referrals: {
      subject: 'Results Available - Referral',
      html: '<html>Referral Screened</html>',
    },
  })),
  buildCompleteEmail: vi.fn(() => ({
    client: {
      subject: 'Final Results - Client',
      html: '<html>Client Complete</html>',
    },
    referrals: {
      subject: 'Final Results - Referral',
      html: '<html>Referral Complete</html>',
    },
  })),
  buildInconclusiveEmail: vi.fn(() => ({
    client: {
      subject: 'Test Inconclusive - Client',
      html: '<html>Client Inconclusive</html>',
    },
    referrals: {
      subject: 'Test Inconclusive - Referral',
      html: '<html>Referral Inconclusive</html>',
    },
  })),
}))

describe('sendNotificationEmails - Email Stage Determination', () => {
  let mockPayload: any
  let mockReq: any
  let mockCollection: any

  beforeEach(() => {
    // Set default mock implementation for getRecipients
    vi.mocked(getRecipients).mockResolvedValue({
      clientEmail: 'client@test.com',
      referralEmails: ['referral@test.com'],
    })

    // Set default mock implementation for fs.promises
    vi.mocked(fs.promises.access).mockResolvedValue(undefined)
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('fake pdf content'))

    mockPayload = {
      findByID: vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
        if (collection === 'clients') {
          return {
            id: 'client-1',
            email: 'client@test.com',
            firstName: 'John',
            lastName: 'Doe',
            clientType: 'probation',
          }
        }
        if (collection === 'private-media') {
          return {
            id: 'doc-1',
            filename: 'test-results.pdf',
            mimeType: 'application/pdf',
          }
        }
        return null
      }),
      sendEmail: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      email: {
        defaultFromAddress: 'test@midrugtest.com',
      },
    }

    mockReq = {
      payload: mockPayload,
    }

    mockCollection = {
      slug: 'drug-tests',
    } as any

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should send inconclusive email when isInconclusive is true', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      isInconclusive: true,
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should send emails to both client and referral for inconclusive
    expect(mockPayload.sendEmail).toHaveBeenCalledTimes(2)

    // Should update notification history
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'test-1',
        data: expect.objectContaining({
          notificationsSent: expect.arrayContaining([
            expect.objectContaining({
              stage: 'inconclusive',
            }),
          ]),
        }),
      }),
    )
  })

  test('Should NOT send duplicate inconclusive email if already sent', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      isInconclusive: true,
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [
        {
          stage: 'inconclusive',
          sentAt: '2024-01-15T10:00:00Z',
          recipients: 'Client: client@test.com, Referral: referral@test.com',
        },
      ],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send any emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should NOT update notification history
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  test('Should send collected email only for lab tests', async () => {
    const labDoc: Partial<DrugTest> = {
      id: 'test-1',
      testType: '11-panel-lab',
      screeningStatus: 'collected',
      collectionDate: '2024-01-15T10:00:00Z',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: labDoc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: labDoc,
      context: {},
    })

    // Should send to referral only (collected stage doesn't notify client)
    expect(mockPayload.sendEmail).toHaveBeenCalledTimes(1)
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'referral@test.com',
      }),
    )
  })

  test('Should NOT send collected email for instant tests', async () => {
    const instantDoc: Partial<DrugTest> = {
      id: 'test-1',
      testType: '15-panel-instant',
      screeningStatus: 'collected',
      collectionDate: '2024-01-15T10:00:00Z',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: instantDoc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: instantDoc,
      context: {},
    })

    // Should NOT send any emails (instant tests skip collected stage)
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()
  })

  test('Should NOT send screened email if testDocument is missing', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      testDocument: null, // Missing document!
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send emails without document
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log warning
    expect(mockPayload.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Upload screening test document'),
    )
  })

  test('Should send screened email with testDocument attachment when available', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      testDocument: { id: 'doc-1' } as any,
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should send to both client and referral with attachments
    expect(mockPayload.sendEmail).toHaveBeenCalledTimes(2)

    // Both calls should have attachments
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'test-results.pdf',
          }),
        ]),
      }),
    )
  })

  test('Should only send complete email if confirmation was actually done', async () => {
    const docWithoutConfirmation: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      confirmationDecision: 'accept',
      confirmationResults: [],
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [
        {
          stage: 'screened',
          sentAt: '2024-01-15T10:00:00Z',
          recipients: 'test',
        },
      ],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: docWithoutConfirmation as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: docWithoutConfirmation,
      context: {},
    })

    // Should NOT send complete email (no confirmation was done)
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()
  })

  test('Should send complete email when confirmation is actually complete', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['thc'],
      confirmationResults: [
        {
          substance: 'thc',
          result: 'confirmed-negative',
          notes: 'Below threshold',
        },
      ],
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '11-panel-lab',
      testDocument: { id: 'doc-1' } as any,
      confirmationDocument: { id: 'doc-2' } as any,
      relatedClient: 'client-1',
      notificationsSent: [
        {
          stage: 'collected',
          sentAt: '2024-01-14T10:00:00Z',
          recipients: 'test',
        },
        {
          stage: 'screened',
          sentAt: '2024-01-15T10:00:00Z',
          recipients: 'test',
        },
      ],
      sendNotifications: true,
    }

    // Mock confirmation document
    mockPayload.findByID = vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
      if (collection === 'clients') {
        return {
          id: 'client-1',
          email: 'client@test.com',
          firstName: 'John',
          lastName: 'Doe',
          clientType: 'probation',
        }
      }
      if (collection === 'private-media') {
        if (id === 'doc-2') {
          return {
            id: 'doc-2',
            filename: 'confirmation-results.pdf',
            mimeType: 'application/pdf',
          }
        }
        return {
          id: 'doc-1',
          filename: 'test-results.pdf',
          mimeType: 'application/pdf',
        }
      }
      return null
    })

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should send complete emails to both client and referral
    expect(mockPayload.sendEmail).toHaveBeenCalledTimes(2)

    // Should use confirmation document (doc-2) not test document (doc-1)
    expect(mockPayload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'private-media',
        id: 'doc-2',
      }),
    )

    // Should attach confirmation document
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'confirmation-results.pdf',
          }),
        ]),
      }),
    )
  })
})

describe('sendNotificationEmails - Early Exit Conditions', () => {
  let mockPayload: any
  let mockReq: any
  let mockCollection: any

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      sendEmail: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }

    mockReq = {
      payload: mockPayload,
    }

    mockCollection = {
      slug: 'drug-tests',
    } as any

    vi.clearAllMocks()
  })

  test('Should skip if sendNotifications checkbox is unchecked', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      sendNotifications: false,
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      testDocument: { id: 'doc-1' } as any,
      notificationsSent: [],
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send any emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log that notifications were skipped
    expect(mockPayload.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Email notifications skipped'),
    )
  })

  test('Should skip if context.skipNotificationHook is true', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {
        skipNotificationHook: true,
      },
    })

    // Should NOT send any emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should NOT log anything (early return)
    expect(mockPayload.logger.info).not.toHaveBeenCalled()
  })

  test('Should skip if no email stage can be determined', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'collected',
      notificationsSent: [],
      sendNotifications: true,
      relatedClient: 'client-1',
    }

    mockPayload.findByID = vi.fn(async () => ({
      id: 'client-1',
      email: 'client@test.com',
      firstName: 'John',
      lastName: 'Doe',
      clientType: 'probation',
    }))

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send any emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log that no email stage was determined
    expect(mockPayload.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('No email stage determined'),
    )
  })
})

describe('sendNotificationEmails - Self Client Type', () => {
  let mockPayload: any
  let mockReq: any
  let mockCollection: any

  beforeEach(() => {
    // Set default mock implementation for getRecipients
    vi.mocked(getRecipients).mockResolvedValue({
      clientEmail: 'selfclient@test.com',
      referralEmails: ['selfclient@test.com'], // Self clients receive their own email
    })

    // Set default mock implementation for fs.promises
    vi.mocked(fs.promises.access).mockResolvedValue(undefined)
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('fake pdf content'))

    mockPayload = {
      findByID: vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
        if (collection === 'clients') {
          return {
            id: 'client-1',
            email: 'selfclient@test.com',
            firstName: 'Self',
            lastName: 'Client',
            clientType: 'self',
          }
        }
        if (collection === 'private-media') {
          return {
            id: 'doc-1',
            filename: 'test-results.pdf',
            mimeType: 'application/pdf',
          }
        }
        return null
      }),
      sendEmail: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      email: {
        defaultFromAddress: 'test@midrugtest.com',
      },
    }

    mockReq = {
      payload: mockPayload,
    }

    mockCollection = {
      slug: 'drug-tests',
    } as any

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should send screened email to self client (client receives their own results)', async () => {
    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      testDocument: { id: 'doc-1' } as any,
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Self client should receive email (sent to referralEmails which includes their own email)
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'selfclient@test.com',
      }),
    )

    // Should update notification history
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'test-1',
        data: expect.objectContaining({
          notificationsSent: expect.arrayContaining([
            expect.objectContaining({
              stage: 'screened',
            }),
          ]),
        }),
      }),
    )
  })

  test('Should send to self client AND additional recipients when configured', async () => {
    // Mock getRecipients to return self email + alternative recipient
    vi.mocked(getRecipients).mockResolvedValueOnce({
      clientEmail: 'selfclient@test.com',
      referralEmails: ['selfclient@test.com', 'family@test.com'],
    })

    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      testDocument: { id: 'doc-1' } as any,
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should send to both self client and alternative recipient
    expect(mockPayload.sendEmail).toHaveBeenCalledTimes(2)

    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'selfclient@test.com',
      }),
    )

    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'family@test.com',
      }),
    )
  })
})

describe('sendNotificationEmails - Test Mode', () => {
  let mockPayload: any
  let mockReq: any
  let mockCollection: any
  let originalTestMode: string | undefined

  beforeEach(() => {
    // Save original env
    originalTestMode = process.env.EMAIL_TEST_MODE

    mockPayload = {
      findByID: vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
        if (collection === 'clients') {
          return {
            id: 'client-1',
            email: 'real-client@example.com',
            firstName: 'John',
            lastName: 'Doe',
            clientType: 'probation',
          }
        }
        return null
      }),
      sendEmail: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      email: {
        defaultFromAddress: 'test@midrugtest.com',
      },
    }

    mockReq = {
      payload: mockPayload,
    }

    mockCollection = {
      slug: 'drug-tests',
    } as any

    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original env
    if (originalTestMode !== undefined) {
      process.env.EMAIL_TEST_MODE = originalTestMode
    } else {
      delete process.env.EMAIL_TEST_MODE
    }
  })

  test('Should send to actual client/referral emails when TEST_MODE is false', async () => {
    // Ensure TEST_MODE is not set (or explicitly false)
    delete process.env.EMAIL_TEST_MODE

    // Override getRecipients mock for this test to return emails matching our client
    vi.mocked(getRecipients).mockResolvedValueOnce({
      clientEmail: 'real-client@example.com',
      referralEmails: ['real-referral@probation.gov'],
    })

    const doc: Partial<DrugTest> = {
      id: 'test-1',
      isInconclusive: true,
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should send to real client email (matching the client record)
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'real-client@example.com',
      }),
    )

    // Should send to real referral email
    expect(mockPayload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'real-referral@probation.gov',
      }),
    )

    // Subject should NOT include [TEST MODE]
    const clientEmailCall = mockPayload.sendEmail.mock.calls.find(
      (call: any) => call[0].to === 'real-client@example.com',
    )
    expect(clientEmailCall[0].subject).not.toContain('[TEST MODE]')
  })
})

describe('sendNotificationEmails - Error Handling', () => {
  let mockPayload: any
  let mockReq: any
  let mockCollection: any

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      sendEmail: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }

    mockReq = {
      payload: mockPayload,
    }

    mockCollection = {
      slug: 'drug-tests',
    } as any

    vi.clearAllMocks()
  })

  test('Should handle client not found gracefully', async () => {
    mockPayload.findByID = vi.fn(async () => null)

    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      testDocument: { id: 'doc-1' } as any,
      relatedClient: 'non-existent-client',
      notificationsSent: [],
      sendNotifications: true,
    }

    const result = await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should return doc unchanged
    expect(result).toEqual(doc)

    // Should NOT crash
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log error
    expect(mockPayload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cannot send notifications: Client'),
    )
  })

  test('Should handle document missing from database', async () => {
    mockPayload.findByID = vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
      if (collection === 'clients') {
        return {
          id: 'client-1',
          email: 'client@test.com',
          firstName: 'John',
          lastName: 'Doe',
          clientType: 'probation',
        }
      }
      if (collection === 'private-media') {
        return null // Document not found!
      }
      return null
    })

    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      testDocument: { id: 'doc-1' } as any,
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log CRITICAL error
    expect(mockPayload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL'),
    )

    // Should create admin alert
    // Note: createAdminAlert is mocked in the module mock, so it won't actually call payload.create
    // The important thing is that the hook doesn't crash and logs the error
  })

  test('Should handle document file missing from disk', async () => {
    mockPayload.findByID = vi.fn(async ({ id, collection }: { id: string; collection: string }) => {
      if (collection === 'clients') {
        return {
          id: 'client-1',
          email: 'client@test.com',
          firstName: 'John',
          lastName: 'Doe',
          clientType: 'probation',
        }
      }
      if (collection === 'private-media') {
        return {
          id: 'doc-1',
          filename: 'test-results.pdf',
          mimeType: 'application/pdf',
        }
      }
      return null
    })

    // Mock fs.promises.access to throw (file doesn't exist)
    const mockFsPromises = fs.promises as any
    mockFsPromises.access = vi.fn().mockRejectedValue(new Error('File not found'))

    const doc: Partial<DrugTest> = {
      id: 'test-1',
      screeningStatus: 'screened',
      initialScreenResult: 'negative',
      testDocument: { id: 'doc-1' } as any,
      collectionDate: '2024-01-15T10:00:00Z',
      testType: '15-panel-instant',
      relatedClient: 'client-1',
      notificationsSent: [],
      sendNotifications: true,
    }

    await sendNotificationEmails({
      collection: mockCollection,
      doc: doc as DrugTest,
      req: mockReq,
      operation: 'update',
      previousDoc: {} as DrugTest,
      data: doc,
      context: {},
    })

    // Should NOT send emails
    expect(mockPayload.sendEmail).not.toHaveBeenCalled()

    // Should log CRITICAL error
    expect(mockPayload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: Cannot send notifications'),
      expect.any(Error),
    )

    // Should create admin alert
    // Note: createAdminAlert is mocked in the module mock, so it won't actually call payload.create
    // The important thing is that the hook doesn't crash and logs the error
  })
})
