import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { runRedwoodHeadshotSyncJob } from '@/collections/Clients/services/redwoodHeadshotSync'
import { runRedwoodImportClientJob } from '@/collections/Clients/services/redwoodImportWorkflow'
import { queueRedwoodHeadshotSync, queueRedwoodImportForClient } from '@/lib/redwood/queue'

type RedwoodDevAction = 'import-inline' | 'import-queue' | 'headshot-inline' | 'headshot-queue'

function isValidAction(value: string): value is RedwoodDevAction {
  return (
    value === 'import-inline' ||
    value === 'import-queue' ||
    value === 'headshot-inline' ||
    value === 'headshot-queue'
  )
}

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

  if (!isValidAction(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
  }

  try {
    if (action === 'import-inline') {
      const canShowHeadedBrowser =
        process.platform !== 'linux' || Boolean(process.env.DISPLAY) || Boolean(process.env.WAYLAND_DISPLAY)

      if (!canShowHeadedBrowser) {
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
        playwrightHeadless: false,
        playwrightSlowMoMs: Number.isFinite(inlineSlowMoMs) && inlineSlowMoMs > 0 ? inlineSlowMoMs : 200,
      })

      return NextResponse.json({
        mode: 'inline',
        task: 'redwood-import-client',
        status: result.status,
        matchedBy: result.matchedBy ?? null,
        screenshotPath: result.screenshotPath ?? null,
        headed: true,
      })
    }

    if (action === 'import-queue') {
      const queued = await queueRedwoodImportForClient(clientId, 'manual', payload)

      return NextResponse.json({
        mode: 'queue',
        task: 'redwood-import-client',
        status: 'queued',
        jobId: queued.jobId,
      })
    }

    if (action === 'headshot-inline') {
      const result = await runRedwoodHeadshotSyncJob(payload, clientId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to run Redwood headshot sync')
      }

      return NextResponse.json({
        mode: 'inline',
        task: 'redwood-sync-headshot',
        status: 'synced',
        headshotId: result.headshotId ?? null,
        matchedDonor: result.matchedDonor ?? null,
      })
    }

    const queued = await queueRedwoodHeadshotSync(clientId, undefined, payload)

    return NextResponse.json({
      mode: 'queue',
      task: 'redwood-sync-headshot',
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
