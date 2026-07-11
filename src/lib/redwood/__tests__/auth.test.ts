import { afterEach, describe, expect, it } from 'vitest'

import { normalizeRedwoodEnvCredential, resolveRedwoodAuthEnv } from '@/lib/redwood/auth'

describe('Redwood HTTP authentication config', () => {
  afterEach(() => {
    delete process.env.REDWOOD_LOGIN_URL
    delete process.env.REDWOOD_USERNAME
    delete process.env.REDWOOD_PASSWORD
  })

  it('normalizes credentials copied with wrapping quotes', () => {
    expect(normalizeRedwoodEnvCredential(' "redwood-user" ')).toEqual({
      value: 'redwood-user',
      hadWrappingQuotes: true,
    })
  })

  it('resolves credentials for the direct HTTP session', () => {
    process.env.REDWOOD_USERNAME = 'redwood-user'
    process.env.REDWOOD_PASSWORD = 'redwood-password'

    expect(resolveRedwoodAuthEnv()).toEqual({
      loginUrl: 'https://toxaccess.redwoodtoxicology.com/Pages/Public/Login.aspx',
      password: 'redwood-password',
      username: 'redwood-user',
    })
  })
})
