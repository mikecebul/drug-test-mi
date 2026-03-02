import { execFileSync } from 'node:child_process'
import path from 'node:path'

function parseResult(output: string) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const markerLine = [...lines].reverse().find((line) => line.startsWith('__JSON__'))
  if (!markerLine) {
    throw new Error(`Unable to parse db op result. Output:\n${output}`)
  }

  return JSON.parse(markerLine.slice('__JSON__'.length))
}

function getTsxBin() {
  const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
  return path.resolve(process.cwd(), 'node_modules', '.bin', binName)
}

export function runDbOp<T>(command: string, payload?: unknown): T {
  const args = ['tests/e2e/helpers/db-ops.ts', command]
  if (payload !== undefined) {
    args.push(JSON.stringify(payload))
  }

  const tsxBin = getTsxBin()

  try {
    const output = execFileSync(tsxBin, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    })

    return parseResult(output) as T
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stderr =
      typeof error === 'object' && error && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr || '')
        : ''
    const stdout =
      typeof error === 'object' && error && 'stdout' in error
        ? String((error as { stdout?: unknown }).stdout || '')
        : ''

    throw new Error(
      `DB op "${command}" failed via tsx.\nMessage: ${message}\nStdout:\n${stdout || '(empty)'}\nStderr:\n${stderr || '(empty)'}`,
    )
  }
}
