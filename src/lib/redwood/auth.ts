export const DEFAULT_REDWOOD_LOGIN_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/Public/Login.aspx'

export type RedwoodAuthEnv = {
  loginUrl: string
  password: string
  username: string
}

export function normalizeRedwoodEnvCredential(rawValue: string | undefined): {
  value: string
  hadWrappingQuotes: boolean
} {
  if (typeof rawValue !== 'string') {
    return { value: '', hadWrappingQuotes: false }
  }

  const trimmed = rawValue.trim()
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"')
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'")

  if (hasDoubleQuotes || hasSingleQuotes) {
    return {
      value: trimmed.slice(1, -1),
      hadWrappingQuotes: true,
    }
  }

  return { value: trimmed, hadWrappingQuotes: false }
}

export function resolveRedwoodAuthEnv(): RedwoodAuthEnv {
  const username = normalizeRedwoodEnvCredential(process.env.REDWOOD_USERNAME).value
  const password = normalizeRedwoodEnvCredential(process.env.REDWOOD_PASSWORD).value
  const loginUrl = process.env.REDWOOD_LOGIN_URL?.trim() || DEFAULT_REDWOOD_LOGIN_URL

  if (!username) {
    throw new Error('Missing required environment variable: REDWOOD_USERNAME')
  }

  if (!password) {
    throw new Error('Missing required environment variable: REDWOOD_PASSWORD')
  }

  return {
    loginUrl,
    password,
    username,
  }
}
