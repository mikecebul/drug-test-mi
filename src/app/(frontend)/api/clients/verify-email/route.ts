import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { baseUrl } from '@/utilities/baseUrl'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { errors: [{ message: 'Email is required' }] },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Find the user by email
    const users = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: email,
        },
      },
    })

    if (users.docs.length === 0) {
      return NextResponse.json(
        { errors: [{ message: 'No account found with this email address' }] },
        { status: 404 }
      )
    }

    const user = users.docs[0]

    // Check if user is already verified
    if (user._verified) {
      return NextResponse.json(
        { errors: [{ message: 'Account is already verified' }] },
        { status: 400 }
      )
    }

    // Generate a new verification token like PayloadCMS does
    const verificationToken = randomBytes(32).toString('hex')

    // Update user with new verification token
    await payload.update({
      collection: 'clients',
      id: user.id,
      data: {
        _verificationToken: verificationToken,
      }
    })

    // Generate verification URL (same pattern as Clients collection config)
    const verifyURL = `${baseUrl}/verify-email?token=${verificationToken}`

    // Send email using the same template as configured in Clients collection
    await payload.sendEmail({
      to: email,
      subject: 'Verify Your Email Address - MI Drug Test',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Verify Your Email Address</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .button { display: inline-block; padding: 12px 24px; background-color: #007cba; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Verify Your Email Address</h1>
              </div>

              <p>Hello ${user.firstName || user.name || email},</p>

              <p>Thank you for registering with MI Drug Test! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>

              <div style="text-align: center;">
                <a href="${verifyURL}" class="button">Verify My Email</a>
              </div>

              <p>This verification link will expire in 24 hours for security reasons.</p>

              <p>Once verified, you'll be able to schedule your drug screening appointment and access your account.</p>

              <p>If you didn't create this account, you can safely ignore this email.</p>

              <div class="footer">
                <p>Best regards,<br>The MI Drug Test Team</p>
                <p><small>This is an automated message, please do not reply to this email.</small></p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    return NextResponse.json({ message: 'Verification email sent successfully' })
  } catch (error) {
    console.error('Error sending verification email:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to send verification email' }] },
      { status: 500 }
    )
  }
}