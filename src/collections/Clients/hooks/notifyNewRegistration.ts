import { CollectionAfterChangeHook } from 'payload'

export const notifyNewRegistration: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') {
    return doc
  }

  if (req.user) {
    return doc
  }

  try {
    const { payload } = req

    const referralTypeMap: Record<string, string> = {
      court: 'Court',
      employer: 'Employer',
      self: 'Self',
    }

    const referralTypeName = referralTypeMap[doc.referralType] || doc.referralType || 'Not specified'

    let referralName = ''
    let recipientRows: Array<{ name: string; email: string }> = []

    const normalizeReferralContacts = (referral: any): Array<{ name: string; email: string }> => {
      const map = new Map<string, { name: string; email: string }>()
      const add = (contact: { name?: string; email?: string }) => {
        const email = typeof contact.email === 'string' ? contact.email.trim() : ''
        if (!email) return
        const key = email.toLowerCase()
        const name = typeof contact.name === 'string' ? contact.name.trim() : ''
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { name, email })
          return
        }
        if (!existing.name && name) {
          map.set(key, { name, email: existing.email })
        }
      }

      for (const contact of referral?.contacts || []) {
        add(contact || {})
      }

      // Legacy fallback
      add({ name: referral?.mainContactName, email: referral?.mainContactEmail })
      for (const row of referral?.recipientEmails || []) {
        add({ email: row?.email })
      }

      return Array.from(map.values())
    }

    const appendUniqueRecipients = (
      existing: Array<{ name: string; email: string }>,
      additional: Array<{ name?: string; email?: string }> | undefined,
    ) => {
      const map = new Map<string, { name: string; email: string }>()
      const add = (recipient: { name?: string; email?: string }) => {
        const email = typeof recipient.email === 'string' ? recipient.email.trim() : ''
        if (!email) return
        const key = email.toLowerCase()
        const name = typeof recipient.name === 'string' ? recipient.name.trim() : ''
        const current = map.get(key)
        if (!current) {
          map.set(key, { name, email })
          return
        }
        if (!current.name && name) {
          map.set(key, { name, email: current.email })
        }
      }

      existing.forEach(add)
      ;(additional || []).forEach(add)

      return Array.from(map.values())
    }

    if (doc.referralType === 'court' || doc.referralType === 'employer') {
      const relationTo = doc.referralType === 'court' ? 'courts' : 'employers'
      const referralValue =
        typeof doc.referral === 'object'
          ? (doc.referral?.value as string | undefined)
          : typeof doc.referral === 'string'
            ? doc.referral
            : undefined

      if (referralValue) {
        const referral = await payload.findByID({
          collection: relationTo,
          id: referralValue,
          depth: 0,
          overrideAccess: true,
        })

        referralName = referral?.name || ''
        recipientRows = normalizeReferralContacts(referral)
      }

      recipientRows = appendUniqueRecipients(
        recipientRows,
        (doc.referralAdditionalRecipients || []) as Array<{ name?: string; email?: string }>,
      )
    }

    if (doc.referralType === 'self') {
      recipientRows = appendUniqueRecipients(
        (doc.selfReferral?.recipients || []) as Array<{ name: string; email: string }>,
        (doc.referralAdditionalRecipients || []) as Array<{ name?: string; email?: string }>,
      )
    }

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
                <span class="label">Referral Type:</span> ${referralTypeName}
              </div>

              ${referralName ? `<div class="detail-row"><span class="label">Referral:</span> ${referralName}</div>` : ''}
    `

    if (recipientRows.length > 0) {
      emailBody += `
              <div class="detail-row">
                <span class="label">Recipients:</span>
                <ul style="margin: 5px 0; padding-left: 20px;">
      `

      recipientRows.forEach((recipient) => {
        emailBody += `<li>${recipient.name ? `${recipient.name} ` : ''}(${recipient.email})</li>`
      })

      emailBody += `
                </ul>
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

    await payload.sendEmail({
      to: ['mike@midrugtest.com', 'tom@midrugtest.com'],
      from: payload.email.defaultFromAddress,
      subject: `New Client Registration - ${doc.firstName} ${doc.lastName}`,
      html: emailBody,
    })

    payload.logger.info(
      `New registration notification sent to mike@midrugtest.com and tom@midrugtest.com for client ${doc.email}`,
    )
  } catch (error) {
    req.payload.logger.error(`Failed to send registration notification: ${error}`)
  }

  return doc
}
