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
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '100px 80px 40px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                Schedule Your Test
              </h1>
              <p
                style={{
                  fontSize: 24,
                  color: '#64748b',
                  margin: '8px 0 0 0',
                }}
              >
                MI DRUG TEST LLC
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#005a9c',
                padding: '12px 24px',
                borderRadius: '12px',
              }}
            >
              <span
                style={{
                  color: '#ffffff',
                  fontSize: 20,
                  fontWeight: '600',
                }}
              >
                Book Now
              </span>
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
              padding: '20px 80px 100px',
            }}
          >
            {/* Simple centered content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontSize: 72,
                  fontWeight: 'bold',
                  color: '#0f172a',
                  margin: '0 0 32px 0',
                  lineHeight: 1.1,
                }}
              >
                Schedule Your Test
              </h2>
              <p
                style={{
                  fontSize: 36,
                  color: '#64748b',
                  margin: 0,
                  fontWeight: '400',
                }}
              >
                Quick & Easy Online Booking
              </p>
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
    console.error('Schedule OG Image generation failed:', e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}