import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { NextResponse } from 'next/server'

type PlaywrightSuite = 'registration' | 'wizard' | 'smoke'

const SUITE_TO_SCRIPT: Record<PlaywrightSuite, string> = {
  registration: 'test:e2e:registration',
  wizard: 'test:e2e:wizard',
  smoke: 'test:e2e:smoke',
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let suite: PlaywrightSuite | null = null

  try {
    const body = (await req.json().catch(() => ({}))) as { suite?: string }
    if (body.suite === 'registration' || body.suite === 'wizard' || body.suite === 'smoke') {
      suite = body.suite
    }
  } catch {
    // no-op, suite stays null
  }

  if (!suite) {
    return NextResponse.json({ error: 'Invalid suite' }, { status: 400 })
  }

  const script = SUITE_TO_SCRIPT[suite]
  const outputDir = path.resolve(process.cwd(), 'output', 'dev-tools')
  await fsp.mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(outputDir, `playwright-${suite}-${timestamp}.log`)
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })

  logStream.write(`[${new Date().toISOString()}] Starting: pnpm ${script}\n`)

  const child = spawn('pnpm', [script], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.pipe(logStream)
  child.stderr?.pipe(logStream)
  child.unref()

  return NextResponse.json({
    status: 'started',
    suite,
    script: `pnpm ${script}`,
    pid: child.pid,
    logPath,
  })
}
