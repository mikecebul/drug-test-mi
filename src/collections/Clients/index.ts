import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'
import { baseUrl } from '@/utilities/baseUrl'
import { anyone } from '@/access/anyone'
import { notifyNewRegistration } from './hooks/notifyNewRegistration'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import { HeadshotCell } from './components/HeadshotCell'

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
  hooks: {
    afterChange: [notifyNewRegistration],
  },
  admin: {
    defaultColumns: ['headshot', 'lastName', 'email', 'clientType'],
    useAsTitle: 'name',
    listSearchableFields: ['email', 'firstName', 'lastName'],
  },
  fields: [
    // Sidebar fields - always visible
    {
      name: 'name',
      type: 'text',
      virtual: true,
      admin: {
        description: 'Full name (computed from first and last name)',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        afterRead: [
          ({ data }) => {
            if (data?.firstName && data?.lastName) {
              return `${data.firstName} ${data.lastName}`
            }
            return data?.firstName || data?.lastName || ''
          },
        ],
      },
    },
    {
      name: 'headshot',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Client headshot photo for identification during testing',
        position: 'sidebar',
        components: {
          Cell: '@/collections/Clients/components/HeadshotCell#HeadshotCell',
        },
      },
      filterOptions: {
        mimeType: {
          contains: 'image',
        },
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
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
        position: 'sidebar',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this client is active',
        position: 'sidebar',
      },
    },

    // Main content organized in tabs
    {
      type: 'tabs',
      tabs: [
        // Tab 1: Personal Information
        {
          label: 'Personal Information',
          description: 'Basic client details and contact information',
          fields: [
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
              name: 'dob',
              type: 'date',
              admin: {
                description: 'Date of birth',
                date: {
                  pickerAppearance: 'dayOnly',
                  displayFormat: 'MM/dd/yyyy',
                },
              },
            },
            {
              name: 'gender',
              type: 'select',
              options: [
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Other', value: 'other' },
                { label: 'Prefer not to say', value: 'prefer-not-to-say' },
              ],
              admin: {
                description: 'Client gender identity',
              },
            },
            {
              name: 'phone',
              type: 'text',
              admin: {
                description: 'Phone number for contact',
              },
            },
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
          ],
        },

        // Tab 2: Service Details
        {
          label: 'Service Details',
          description: 'Information about who is requesting services',
          fields: [
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
                {
                  name: 'ccEmail',
                  type: 'email',
                  admin: {
                    description: 'Additional email to CC on test results',
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
          ],
        },

        // Tab 3: Testing History
        {
          label: 'Testing History',
          description: 'Drug tests and appointment bookings',
          fields: [
            // Drug tests (auto-populated via join)
            {
              name: 'drugTests',
              type: 'join',
              collection: 'drug-tests',
              on: 'relatedClient',
              admin: {
                description: 'Drug tests automatically linked to this client',
              },
            },
            // Bookings (auto-populated via join)
            {
              name: 'bookings',
              type: 'join',
              collection: 'bookings',
              on: 'relatedClient',
              admin: {
                description: 'Bookings automatically linked to this client',
              },
            },
          ],
        },

        // Tab 4: Medications
        {
          label: 'Medications',
          description: 'Current and historical medications for drug test verification',
          fields: [
            {
              name: 'medications',
              type: 'array',
              admin: {
                description: 'Track medications that may affect drug test results',
              },
              fields: [
                {
                  name: 'medicationName',
                  type: 'text',
                  required: true,
                  admin: {
                    description: 'Brand or generic name of medication',
                  },
                },
                {
                  name: 'startDate',
                  type: 'date',
                  required: true,
                  admin: {
                    description: 'Date medication was started',
                    date: {
                      pickerAppearance: 'dayOnly',
                      displayFormat: 'MM/dd/yyyy',
                    },
                  },
                },
                {
                  name: 'endDate',
                  type: 'date',
                  admin: {
                    description: 'Date medication was discontinued (leave empty if current)',
                    date: {
                      pickerAppearance: 'dayOnly',
                      displayFormat: 'MM/dd/yyyy',
                    },
                  },
                },
                {
                  name: 'status',
                  type: 'select',
                  required: true,
                  defaultValue: 'active',
                  options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Discontinued', value: 'discontinued' },
                  ],
                  admin: {
                    description:
                      'Current status of this medication. If you need to resume a discontinued medication, add it as a new entry to maintain proper history.',
                  },
                },
                {
                  name: 'detectedAs',
                  type: 'select',
                  hasMany: true,
                  options: allSubstanceOptions as any,
                  admin: {
                    description:
                      'What substance(s) this medication shows as in drug tests. Select all that apply.',
                  },
                },
                {
                  name: 'notes',
                  type: 'textarea',
                  admin: {
                    description: 'Additional notes about this medication',
                  },
                },
                {
                  name: 'createdAt',
                  type: 'date',
                  access: {
                    update: ({ req }) => {
                      // Only super admins can update createdAt
                      return req?.user?.collection === 'admins'
                        ? req?.user?.role === 'superAdmin'
                        : false
                    },
                  },
                  admin: {
                    description:
                      'When this medication was added to the system - editable by super admins only',
                    readOnly: false,
                  },
                },
              ],
            },
          ],
        },

        // Tab 5: Documents
        {
          label: 'Documents',
          description: 'Private documents and test results',
          fields: [
            // Private documents (auto-populated via join)
            {
              name: 'privateDocuments',
              type: 'join',
              collection: 'private-media',
              on: 'relatedClient',
              admin: {
                description: 'Private documents linked to this client',
              },
            },
          ],
        },

        // Tab 6: Notes
        {
          label: 'Notes',
          description: 'Internal notes and comments',
          fields: [
            {
              name: 'notes',
              type: 'textarea',
              admin: {
                description: 'Internal notes about the client (not visible to client)',
              },
            },
          ],
        },
      ],
    },
  ],
}
