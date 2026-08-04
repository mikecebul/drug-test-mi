export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      checks: { application: 'ok' },
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
