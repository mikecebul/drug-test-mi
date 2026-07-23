import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRedwoodHttpSessionMock,
  findExistingActiveRedwoodDonorViaHttpMock,
  findExistingInactiveRedwoodDonorViaHttpMock,
  findRedwoodDonorByNameDobViaHttpMock,
  readRedwoodCallInCodeViaHttpMock,
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
    findRedwoodDonorByNameDobViaHttpMock: vi.fn(),
    readRedwoodCallInCodeViaHttpMock: vi.fn(),
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
  findRedwoodDonorByNameDobViaHttp: findRedwoodDonorByNameDobViaHttpMock,
  readRedwoodCallInCodeViaHttp: readRedwoodCallInCodeViaHttpMock,
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
    findRedwoodDonorByNameDobViaHttpMock.mockReset().mockResolvedValue(null)
    readRedwoodCallInCodeViaHttpMock.mockReset().mockResolvedValue(null)
  })

  it('searches active and inactive donors but never opens the import page when creation is blocked', async () => {
    await expect(
      createRedwoodClientViaHttp(
        {
          accountNumber: '310872',
          dob: '1990-01-01',
          firstName: 'Bob',
          lastName: 'Testing',
        },
        {
          allowCreate: false,
          blockedReason: 'Potential existing Redwood donor: prior Payload test history was found.',
        },
      ),
    ).rejects.toThrow('Potential existing Redwood donor')

    expect(findExistingActiveRedwoodDonorViaHttpMock).toHaveBeenCalledOnce()
    expect(findExistingInactiveRedwoodDonorViaHttpMock).toHaveBeenCalledOnce()
    expect(findExistingActiveRedwoodDonorViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumbers: ['310872'] }),
    )
    expect(session.getText).not.toHaveBeenCalled()
    expect(session.postMultipart).not.toHaveBeenCalled()
    expect(session.postFormData).not.toHaveBeenCalled()
  })

  it('creates with a blank Unique ID and resolves the new donor when upload stays on the import page', async () => {
    session.getText.mockResolvedValue({ text: '<form>import</form>' })
    session.postMultipart.mockResolvedValue({
      text: vi.fn().mockResolvedValue(
        '<input name="ctl00$PageContent$ImportDonor1$FileUpload1" type="file">' +
          '<input name="ctl00$PageContent$ImportDonor1$btnImport" type="submit" value="Upload">',
      ),
    })
    findRedwoodDonorByNameDobViaHttpMock.mockResolvedValue({
      accountNumber: '310872',
      donorId: '2793207',
      matchedBy: 'name-dob',
      matchedDonorName: 'Testing, Bob',
    })
    readRedwoodCallInCodeViaHttpMock.mockResolvedValue('123456')

    const result = await createRedwoodClientViaHttp(
      {
        accountNumber: '310872',
        dob: '1990-01-01',
        firstName: 'Bob',
        lastName: 'Testing',
      },
      {
        searchAccountNumbers: ['310974', '310872'],
      },
    )

    expect(result).toEqual({
      accountNumber: '310872',
      callInCode: '123456',
      donorId: '2793207',
      matchedDonorName: 'Testing, Bob',
      status: 'imported',
    })
    expect(findExistingActiveRedwoodDonorViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumbers: ['310974', '310872'] }),
    )

    const uploadOptions = session.postMultipart.mock.calls[0]?.[2]
    const csv = await uploadOptions.files[0].blob.text()
    const dataRow = csv.trim().split('\n')[1]
    expect(dataRow).toContain('"Testing",,"01/01/1990"')
    expect(dataRow).not.toContain('"Testing","","01/01/1990"')
    expect(dataRow).not.toContain('&quot;')
  })
})
