import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRedwoodHttpSessionMock,
  findExistingActiveRedwoodDonorViaHttpMock,
  findExistingInactiveRedwoodDonorViaHttpMock,
  session,
} = vi.hoisted(() => {
  const session = {
    getText: vi.fn(),
    postFormData: vi.fn(),
    postMultipart: vi.fn(),
    postUrlEncoded: vi.fn(),
  }

  return {
    createRedwoodHttpSessionMock: vi.fn().mockResolvedValue(session),
    findExistingActiveRedwoodDonorViaHttpMock: vi.fn(),
    findExistingInactiveRedwoodDonorViaHttpMock: vi.fn(),
    session,
  }
})

vi.mock('@/lib/redwood/auth', () => ({
  resolveRedwoodAuthEnv: vi.fn(() => ({
    loginUrl: 'https://toxaccess.example.test/login',
    password: 'test-password',
    username: 'test-user',
  })),
}))

vi.mock('@/lib/redwood/http', () => ({
  createRedwoodHttpSession: createRedwoodHttpSessionMock,
  parseRedwoodFormEntries: vi.fn(),
  readRedwoodHtmlAttributes: vi.fn(() => ({})),
  setRedwoodFormEntry: vi.fn(),
  stripRedwoodHtml: vi.fn((value: string) => value),
}))

vi.mock('@/lib/redwood/http-donor-search', () => ({
  findExistingActiveRedwoodDonorViaHttp: findExistingActiveRedwoodDonorViaHttpMock,
  findExistingInactiveRedwoodDonorViaHttp: findExistingInactiveRedwoodDonorViaHttpMock,
  findRedwoodDonorByUniqueIdViaHttp: vi.fn(),
  readRedwoodCallInCodeViaHttp: vi.fn(),
  readRedwoodDonorSearchResults: vi.fn(),
}))

vi.mock('./redwoodClientHttpInactivate', () => ({
  setRedwoodClientActiveStatusViaHttp: vi.fn(),
}))

import { createRedwoodClientViaHttp } from './redwoodClientHttpImport'

describe('Redwood donor creation policy', () => {
  beforeEach(() => {
    session.getText.mockReset()
    session.postFormData.mockReset()
    session.postMultipart.mockReset()
    session.postUrlEncoded.mockReset()
    findExistingActiveRedwoodDonorViaHttpMock.mockReset().mockResolvedValue(null)
    findExistingInactiveRedwoodDonorViaHttpMock.mockReset().mockResolvedValue(null)
  })

  it('searches active and inactive donors but never opens the import page when creation is blocked', async () => {
    await expect(
      createRedwoodClientViaHttp(
        {
          accountNumber: '310872',
          dob: '1990-01-01',
          firstName: 'Bob',
          lastName: 'Testing',
          uniqueId: 'RWD0001',
        },
        {
          allowCreate: false,
          blockedReason: 'Potential existing Redwood donor: prior Payload test history was found.',
        },
      ),
    ).rejects.toThrow('Potential existing Redwood donor')

    expect(findExistingActiveRedwoodDonorViaHttpMock).toHaveBeenCalledOnce()
    expect(findExistingInactiveRedwoodDonorViaHttpMock).toHaveBeenCalledOnce()
    expect(session.getText).not.toHaveBeenCalled()
    expect(session.postMultipart).not.toHaveBeenCalled()
    expect(session.postFormData).not.toHaveBeenCalled()
  })
})
