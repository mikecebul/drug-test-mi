import { createReadinessResponse } from '@/lib/health/readiness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return createReadinessResponse()
}
