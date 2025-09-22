import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            padding: '100px 80px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                MI Drug Test LLC
              </h1>
              <p
                style={{
                  fontSize: 24,
                  color: '#64748b',
                  margin: '8px 0 0 0',
                  textAlign: 'center',
                }}
              >
                Professional Drug Screening Services
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
            }}
          >
            {/* Big Register Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '40px 60px',
                background: 'linear-gradient(135deg, #005a9c, #004080)',
                borderRadius: '20px',
                boxShadow: '0 20px 50px rgba(0, 90, 156, 0.4)',
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  color: '#ffffff',
                  fontWeight: '700',
                }}
              >
                Register Now
              </span>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
              >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e) {
    console.error('Register OG Image generation failed:', e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}