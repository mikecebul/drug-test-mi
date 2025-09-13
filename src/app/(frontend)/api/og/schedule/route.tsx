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
              padding: '60px 80px 40px',
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
              padding: '20px 80px 60px',
              gap: '40px',
            }}
          >
            {/* Headline */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                maxWidth: '900px',
              }}
            >
              <h2
                style={{
                  fontSize: 56,
                  fontWeight: 'bold',
                  color: '#0f172a',
                  margin: '0 0 16px 0',
                  lineHeight: 1.1,
                }}
              >
                Quick & Easy Online Booking
              </h2>
              <p
                style={{
                  fontSize: 28,
                  color: '#64748b',
                  margin: 0,
                }}
              >
                Available 7 Days a Week
              </p>
            </div>

            {/* Stats Grid */}
            <div
              style={{
                display: 'flex',
                gap: '80px',
                marginTop: '20px',
              }}
            >
              {/* Stat 1 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#005a9c"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 'bold',
                    color: '#005a9c',
                    marginBottom: '8px',
                  }}
                >
                  3
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: '#64748b',
                  }}
                >
                  Expert Technicians
                </span>
              </div>

              {/* Stat 2 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#005a9c"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 'bold',
                    color: '#005a9c',
                    marginBottom: '8px',
                  }}
                >
                  10 min
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: '#64748b',
                  }}
                >
                  Appointment Slots
                </span>
              </div>

              {/* Stat 3 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#005a9c"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 'bold',
                    color: '#005a9c',
                    marginBottom: '8px',
                  }}
                >
                  0
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: '#64748b',
                  }}
                >
                  Wait Time
                </span>
              </div>
            </div>

            {/* Benefits */}
            <div
              style={{
                display: 'flex',
                gap: '60px',
                alignItems: 'center',
                marginTop: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span
                  style={{
                    fontSize: 20,
                    color: '#0f172a',
                  }}
                >
                  Real-Time Availability
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span
                  style={{
                    fontSize: 20,
                    color: '#0f172a',
                  }}
                >
                  Instant Confirmation
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span
                  style={{
                    fontSize: 20,
                    color: '#0f172a',
                  }}
                >
                  7 Days a Week
                </span>
              </div>
            </div>

            {/* CTA */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '20px',
                padding: '20px 40px',
                background: 'linear-gradient(135deg, #005a9c, #004080)',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0, 90, 156, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  color: '#ffffff',
                  fontWeight: '600',
                }}
              >
                Schedule Your Appointment
              </span>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
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
    console.error('Schedule OG Image generation failed:', e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}
