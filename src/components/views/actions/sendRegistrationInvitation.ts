'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { baseUrl } from '@/utilities/baseUrl'

export async function sendRegistrationInvitation(email: string, name: string) {
  try {
    const payload = await getPayload({ config })

    // Check if client already exists
    const existingClients = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (existingClients.docs.length > 0) {
      return {
        success: false,
        error: 'A client with this email already exists. Please link the booking manually.',
      }
    }

    const registerURL = `${baseUrl}/register?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`

    // Send invitation email
    await payload.sendEmail({
      to: email,
      subject: 'Complete Your MI Drug Test Registration',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Complete Your Registration</title>
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
                <h1>Complete Your Registration</h1>
              </div>

              <p>Hello ${name},</p>

              <p>We noticed you have an upcoming drug screening appointment with MI Drug Test, but you haven't completed your registration yet.</p>

              <p>To access your appointment details, view your test results, and manage your account, please complete your registration by clicking the button below:</p>

              <div style="text-align: center;">
                <a href="${registerURL}" class="button">Complete Registration</a>
              </div>

              <p>Once registered, you'll be able to:</p>
              <ul>
                <li>View your appointment details</li>
                <li>Access your test results</li>
                <li>Manage your medications and medical history</li>
                <li>Update your contact information</li>
              </ul>

              <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>

              <div class="footer">
                <p>Best regards,<br>The MI Drug Test Team</p>
                <p><small>This is an automated message, please do not reply to this email.</small></p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    payload.logger.info(`Registration invitation sent to ${email}`)

    return {
      success: true,
      message: `Registration invitation sent to ${email}`,
    }
  } catch (error) {
    console.error('Error sending registration invitation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation email',
    }
  }
}
