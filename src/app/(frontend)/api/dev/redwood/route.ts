import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { runRedwoodHeadshotSyncJob } from '@/collections/Clients/services/redwoodHeadshotSync'
import { runRedwoodImportClientJob } from '@/collections/Clients/services/redwoodImportWorkflow'
import { isRedwoodDevAction, REDWOOD_DEV_ACTION_CONFIG } from '@/lib/redwood/dev-actions'
import { canUseHeadedRedwoodBrowser } from '@/lib/redwood/playwright'
import { queueRedwoodHeadshotSync, queueRedwoodImportForClient } from '@/lib/redwood/queue'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    clientId?: string
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''

  if (!isRedwoodDevAction(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
  }

  try {
    const actionConfig = REDWOOD_DEV_ACTION_CONFIG[action]

    if (actionConfig.kind === 'import' && actionConfig.mode === 'inline') {
      if (!canUseHeadedRedwoodBrowser()) {
        return NextResponse.json(
          {
            error:
              'Headed Playwright is unavailable in this runtime (no display server). Run local `pnpm dev` outside Docker to view the browser window.',
          },
          { status: 400 },
        )
      }
    }

    const { default: configPromise } = await import('@payload-config')
    const payload = await getPayload({ config: configPromise })

    if (action === 'import-inline') {
      const inlineSlowMoMs = Number.parseInt(process.env.REDWOOD_DEV_INLINE_SLOW_MO_MS || '200', 10)
      const result = await runRedwoodImportClientJob({
        payload,
        clientId,
        source: 'manual',
        playwrightRuntimeProfile: 'dev-debug',
        playwrightSlowMoMs: Number.isFinite(inlineSlowMoMs) && inlineSlowMoMs > 0 ? inlineSlowMoMs : 200,
      })

      return NextResponse.json({
        mode: actionConfig.mode,
        task: actionConfig.task,
        status: result.status,
        matchedBy: result.matchedBy ?? null,
        screenshotPath: result.screenshotPath ?? null,
        headed: true,
      })
    }

    if (action === 'import-queue') {
      const queued = await queueRedwoodImportForClient(clientId, 'manual', payload)

      return NextResponse.json({
        mode: actionConfig.mode,
        task: actionConfig.task,
        status: 'queued',
        jobId: queued.jobId,
      })
    }

    if (action === 'headshot-inline') {
      const result = await runRedwoodHeadshotSyncJob(payload, clientId)
      if (!result.success && result.retryable !== false) {
        throw new Error(result.error || 'Failed to run Redwood headshot sync')
      }

      return NextResponse.json({
        mode: actionConfig.mode,
        task: actionConfig.task,
        status: result.status || 'failed',
        headshotId: result.headshotId ?? null,
        matchedDonor: result.matchedDonor ?? null,
      })
    }

    const queued = await queueRedwoodHeadshotSync(clientId, undefined, payload)

    return NextResponse.json({
      mode: actionConfig.mode,
      task: actionConfig.task,
      status: 'queued',
      jobId: queued.jobId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown Redwood dev error',
      },
      { status: 500 },
    )
  }
}
