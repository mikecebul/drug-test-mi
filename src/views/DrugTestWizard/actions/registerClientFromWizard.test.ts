import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }))
vi.mock('../server/requireWizardAdmin', () => ({
  requireWizardAdmin: async () => ({
    payload: {
      find: mocks.find,
      create: mocks.create,
      logger: { info: vi.fn(), error: vi.fn() },
    },
  }),
}))

import { registerClientFromWizard } from './registerClientFromWizard'

const client = {
  firstName: 'Test',
  lastName: 'Registration',
  dob: '1990-01-15',
  phone: '2315550100',
  email: 'inline-registration@example.com',
  referralType: 'self',
} as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockResolvedValue({ docs: [] })
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'new-client', ...data }))
})

test.each([
  ['male', 'male'],
  ['female', 'female'],
  ['prefer-not-to-say', 'prefer-not-to-say'],
  ['other', 'prefer-not-to-say'],
])('inline registration preserves the supported gender %s as %s', async (gender, expected) => {
  const result = await registerClientFromWizard({ ...client, gender })

  expect(result.success).toBe(true)
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ gender: expected }) }),
  )
})

test.each(['', 'unknown'])('inline registration rejects invalid gender %j before changing data', async (gender) => {
  const result = await registerClientFromWizard({ ...client, gender })

  expect(result).toEqual({ success: false, error: 'Select a valid gender.' })
  expect(mocks.find).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
})
