import { CollectionAfterChangeHook } from 'payload'

export const notifyNewRegistration: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  // Only run on create operations
  if (operation !== 'create') {
    return doc
  }

  // Only send email for website registrations (when req.user is null/undefined)
  // Admin-created clients will have req.user set
  if (req.user) {
    return doc
  }

  try {
    const { payload } = req

    // Format client type for display
    const clientTypeMap: Record<string, string> = {
      probation: 'Probation/Court',
      employment: 'Employment',
      self: 'Self-Pay/Individual',
    }

    const clientTypeName = clientTypeMap[doc.clientType] || doc.clientType || 'Not specified'

    // Build email body with client details
    let emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>New Client Registration</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007cba; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #007cba; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Client Registration</h1>
            </div>
            <div class="content">
              <p>A new client has registered through the website:</p>

              <div class="detail-row">
                <span class="label">Name:</span> ${doc.firstName} ${doc.lastName}
              </div>

              <div class="detail-row">
                <span class="label">Email:</span> ${doc.email}
              </div>

              ${doc.phone ? `<div class="detail-row"><span class="label">Phone:</span> ${doc.phone}</div>` : ''}

              ${doc.dob ? `<div class="detail-row"><span class="label">Date of Birth:</span> ${new Date(doc.dob).toLocaleDateString()}</div>` : ''}

              ${doc.gender ? `<div class="detail-row"><span class="label">Gender:</span> ${doc.gender}</div>` : ''}

              <div class="detail-row">
                <span class="label">Client Type:</span> ${clientTypeName}
              </div>
    `

    // Add type-specific information
    if (doc.clientType === 'employment' && doc.employmentInfo) {
      emailBody += `
              <div class="detail-row">
                <span class="label">Employer:</span> ${doc.employmentInfo.employerName || 'N/A'}
              </div>
      `

      // Display all recipients
      if (doc.employmentInfo.recipients && doc.employmentInfo.recipients.length > 0) {
        emailBody += `
              <div class="detail-row">
                <span class="label">Recipients:</span>
                <ul style="margin: 5px 0; padding-left: 20px;">
        `
        doc.employmentInfo.recipients.forEach((recipient: { name: string; email: string }) => {
          emailBody += `
                  <li>${recipient.name} (${recipient.email})</li>
          `
        })
        emailBody += `
                </ul>
              </div>
        `
      }
    }

    if (doc.clientType === 'probation' && doc.courtInfo) {
      emailBody += `
              <div class="detail-row">
                <span class="label">Court:</span> ${doc.courtInfo.courtName || 'N/A'}
              </div>
      `

      // Display all recipients
      if (doc.courtInfo.recipients && doc.courtInfo.recipients.length > 0) {
        emailBody += `
              <div class="detail-row">
                <span class="label">Recipients:</span>
                <ul style="margin: 5px 0; padding-left: 20px;">
        `
        doc.courtInfo.recipients.forEach((recipient: { name: string; email: string }) => {
          emailBody += `
                  <li>${recipient.name} (${recipient.email})</li>
          `
        })
        emailBody += `
                </ul>
              </div>
        `
      }
    }

    if (doc.clientType === 'self' && doc.alternativeRecipient?.name) {
      emailBody += `
              <div class="detail-row">
                <span class="label">Alternative Recipient:</span> ${doc.alternativeRecipient.name} (${doc.alternativeRecipient.email || 'N/A'})
              </div>
      `
    }

    emailBody += `
              <div class="footer">
                <p>This is an automated notification from MI Drug Test website registration.</p>
                <p><small>Registration time: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email notification
    await payload.sendEmail({
      to: 'mike@midrugtest.com',
      from: payload.email.defaultFromAddress,
      subject: `New Client Registration - ${doc.firstName} ${doc.lastName}`,
      html: emailBody,
    })

    payload.logger.info(
      `New registration notification sent to mike@midrugtest.com for client ${doc.email}`,
    )
  } catch (error) {
    // Log error but don't fail the registration
    req.payload.logger.error(`Failed to send registration notification: ${error}`)
  }

  return doc
}