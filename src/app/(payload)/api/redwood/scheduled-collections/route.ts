import config from '@payload-config'
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'

import { previewTodaysScheduledCollections } from '@/lib/random-testing/todays-schedule'

export const dynamic = 'force-dynamic'

async function authorize(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return {
      payload,
      response: NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 }),
    }
  }
  if (user.collection !== 'admins') {
    return {
      payload,
      response: NextResponse.json({ success: false, error: 'Admin account required.' }, { status: 403 }),
    }
  }
  return { payload, response: null }
}

export async function GET(request: NextRequest) {
  const { payload, response } = await authorize(request)
  if (response) return response

  try {
    const collections = await previewTodaysScheduledCollections(payload)
    return NextResponse.json({
      success: true,
      count: collections.length,
      collections,
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Failed to preview ToxAccess Scheduled Collections' })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'ToxAccess preview failed.',
      },
      { status: 502 },
    )
  }
}
