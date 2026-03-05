import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_INSTANT_PDF = '/Users/mikecebul/Documents/Drug Tests/Shane Sutherland/SS_Instant_10-6-25.pdf'
const DEFAULT_LAB_SCREEN_PDF = '/Users/mikecebul/Documents/Drug Tests/Tom Vachon/TV_Lab_1-7-26.pdf'
const DEFAULT_LAB_CONFIRM_PDF = '/Users/mikecebul/Documents/Drug Tests/Tom Vachon/TV_Confirm_10-3-25.pdf'

export type E2EEnv = {
  pdfInstantPath: string
  pdfLabScreenPath: string
  pdfLabConfirmPath: string
  mailpitApiBase: string
  smtpWebBase: string
  requireEmailTestModeFalse: boolean
  enableMailpitAssertions: boolean
}

let dotEnvLoaded = false

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
  return fallback
}

function stripWrappedQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

export function ensureDotEnvLoaded() {
  if (dotEnvLoaded) return

  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    dotEnvLoaded = true
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) continue

    const key = line.slice(0, equalsIndex).trim()
    if (!key || key in process.env) continue

    const value = stripWrappedQuotes(line.slice(equalsIndex + 1).trim())
    process.env[key] = value
  }

  dotEnvLoaded = true
}

function assertReadableFile(filePath: string, envName: string) {
  if (!filePath.trim()) {
    throw new Error(`${envName} is required and cannot be empty.`)
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`${envName} does not exist: ${filePath}`)
  }

  fs.accessSync(filePath, fs.constants.R_OK)
}

export function getE2EEnv(options?: { requirePdfs?: boolean }): E2EEnv {
  ensureDotEnvLoaded()

  const env: E2EEnv = {
    pdfInstantPath: process.env.E2E_PDF_INSTANT_PATH || DEFAULT_INSTANT_PDF,
    pdfLabScreenPath: process.env.E2E_PDF_LAB_SCREEN_PATH || DEFAULT_LAB_SCREEN_PDF,
    pdfLabConfirmPath: process.env.E2E_PDF_LAB_CONFIRM_PATH || DEFAULT_LAB_CONFIRM_PDF,
    mailpitApiBase: process.env.E2E_MAILPIT_API_BASE || 'http://127.0.0.1:8025/api/v1',
    smtpWebBase: process.env.E2E_SMTP_WEB_BASE || 'http://127.0.0.1:8025',
    requireEmailTestModeFalse: parseBoolean(process.env.E2E_REQUIRE_EMAIL_TEST_MODE_FALSE, true),
    enableMailpitAssertions: parseBoolean(process.env.E2E_ENABLE_MAILPIT_ASSERTIONS, false),
  }

  if (options?.requirePdfs !== false) {
    assertReadableFile(env.pdfInstantPath, 'E2E_PDF_INSTANT_PATH')
    assertReadableFile(env.pdfLabScreenPath, 'E2E_PDF_LAB_SCREEN_PATH')
    assertReadableFile(env.pdfLabConfirmPath, 'E2E_PDF_LAB_CONFIRM_PATH')
  }

  if (env.requireEmailTestModeFalse && parseBoolean(process.env.EMAIL_TEST_MODE, false)) {
    throw new Error('Unsafe email mode: EMAIL_TEST_MODE=true. Set EMAIL_TEST_MODE=false for mailbox recipient assertions.')
  }

  return env
}
