import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'
import { baseUrl } from '@/utilities/baseUrl'
import { anyone } from '@/access/anyone'

export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: {
    singular: 'Client',
    plural: 'Clients',
  },
  auth: {
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const verifyURL = `${baseUrl}/verify-email?token=${token}`

        return `
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

                <p>Hello ${user.name || user.email},</p>

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
        `
      },
      generateEmailSubject: () => 'Verify Your Email Address - MI Drug Test',
    },
    forgotPassword: {
      generateEmailHTML: (args) => {
        const { token, user } = args || {}
        const resetURL = `${baseUrl}/reset-password?token=${token}`

        return `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Reset Your Password</title>
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
                  <h1>Reset Your Password</h1>
                </div>

                <p>Hello ${user.name || user.email},</p>

                <p>You recently requested to reset your password for your MI Drug Test account. Click the button below to reset it:</p>

                <div style="text-align: center;">
                  <a href="${resetURL}" class="button">Reset My Password</a>
                </div>

                <p>This password reset link will expire in 1 hour for security reasons.</p>

                <p>If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>

                <div class="footer">
                  <p>Best regards,<br>The MI Drug Test Team</p>
                  <p><small>This is an automated message, please do not reply to this email.</small></p>
                </div>
              </div>
            </body>
          </html>
        `
      },
      generateEmailSubject: () => 'Reset Your Password - MI Drug Test',
    },
  },
  access: {
    create: anyone,
    delete: superAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false

      // Users from the users collection (admins) can read all clients
      if (user.collection === 'admins') {
        return true
      }

      // Users from the clients collection can only read their own record
      if (user.collection === 'clients') {
        return {
          id: {
            equals: user.id,
          },
        }
      }

      return false
    },
    update: ({ req: { user } }) => {
      // Admins can update any client records
      if (user?.collection === 'admins') {
        return true
      }

      // Clients can only update their own records
      if (user?.collection === 'clients') {
        return {
          id: {
            equals: user.id,
          },
        }
      }

      return false
    },
  },
  admin: {
    defaultColumns: ['headshot', 'name', 'email', 'clientType', 'totalBookings', 'lastBookingDate'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false, // Keep for migration purposes
      index: true,
      admin: {
        description: 'Legacy full name field - will be removed after migration',
      },
    },
    {
      name: 'firstName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Phone number for contact',
      },
    },
    {
      name: 'headshot',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Client headshot photo for identification during testing',
      },
      filterOptions: {
        mimeType: {
          contains: 'image',
        },
      },
    },
    {
      name: 'clientType',
      type: 'select',
      options: [
        { label: 'Probation/Court', value: 'probation' },
        { label: 'Employment', value: 'employment' },
        { label: 'Self-Pay/Individual', value: 'self' },
      ],
      admin: {
        description: 'Type of client - determines required fields',
      },
    },
    // Probation/Court specific fields
    {
      name: 'courtInfo',
      type: 'group',
      admin: {
        condition: (_data, siblingData) => siblingData?.clientType === 'probation',
        description: 'Court and probation officer information',
      },
      fields: [
        {
          name: 'courtName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of the court',
          },
        },
        {
          name: 'probationOfficerName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of probation officer',
          },
        },
        {
          name: 'probationOfficerEmail',
          type: 'email',
          required: true,
          admin: {
            description: 'Email of probation officer',
          },
        },
      ],
    },
    // Employment specific fields
    {
      name: 'employmentInfo',
      type: 'group',
      admin: {
        condition: (_data, siblingData) => siblingData?.clientType === 'employment',
        description: 'Employer and contact information',
      },
      fields: [
        {
          name: 'employerName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of employer/company',
          },
        },
        {
          name: 'contactName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of HR contact or hiring manager',
          },
        },
        {
          name: 'contactEmail',
          type: 'email',
          required: true,
          admin: {
            description: 'Email of HR contact or hiring manager',
          },
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about the client',
      },
    },
    // Alternative recipient for self-pay clients
    {
      name: 'alternativeRecipient',
      type: 'group',
      admin: {
        condition: (_data, siblingData) => siblingData?.clientType === 'self',
        description: 'Alternative recipient for test results (self-pay clients only)',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          admin: {
            description: 'Name of alternative recipient',
          },
        },
        {
          name: 'email',
          type: 'email',
          admin: {
            description: 'Email of alternative recipient',
          },
        },
      ],
    },
    // Drug screen results (auto-populated via join)
    {
      name: 'drugScreenResults',
      type: 'join',
      collection: 'private-media',
      on: 'relatedClient',
      where: {
        documentType: {
          equals: 'drug-screen',
        },
      },
      admin: {
        description: 'Drug screen result documents automatically linked to this client',
      },
    },
    // Calculated fields updated by hooks
    {
      name: 'totalBookings',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Total number of bookings made by this client',
        readOnly: true,
      },
    },
    {
      name: 'lastBookingDate',
      type: 'date',
      admin: {
        description: 'Date of most recent booking',
        readOnly: true,
      },
    },
    {
      name: 'firstBookingDate',
      type: 'date',
      admin: {
        description: 'Date of first booking',
        readOnly: true,
      },
    },
    // Contact preferences
    {
      name: 'preferredContactMethod',
      type: 'select',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Text/SMS', value: 'sms' },
      ],
      defaultValue: 'email',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this client is active',
      },
    },
  ],
}
