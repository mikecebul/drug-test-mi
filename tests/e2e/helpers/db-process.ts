import { execFileSync } from 'node:child_process'

function parseResult(output: string) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const markerLine = [...lines].reverse().find((line) => line.startsWith('__JSON__'))
  if (!markerLine) {
    throw new Error(`Unable to parse db op result. Output:\n${output}`)
  }

  return JSON.parse(markerLine.slice('__JSON__'.length))
}

export function runDbOp<T>(command: string, payload?: unknown): T {
  const args = ['tsx', 'tests/e2e/helpers/db-ops.ts', command]
  if (payload !== undefined) {
    args.push(JSON.stringify(payload))
  }

  const output = execFileSync('pnpm', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })

  return parseResult(output) as T
}
