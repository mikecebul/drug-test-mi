import { CollectionConfig } from 'payload'
import { superAdmin } from '@/access/superAdmin'
import { admins } from '@/access/admins'
import { computeTestResults } from './hooks/computeTestResults'
import { sendNotificationEmails } from './hooks/sendNotificationEmails'
import { allSubstanceOptions } from '@/fields/substanceOptions'

export const DrugTests: CollectionConfig = {
  slug: 'drug-tests',
  labels: {
    singular: 'Drug Test',
    plural: 'Drug Tests',
  },
  hooks: {
    beforeChange: [computeTestResults],
    afterChange: [sendNotificationEmails],
  },
  access: {
    create: admins,
    delete: superAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false

      // Users from the admins collection can access all drug tests
      if (user.collection === 'admins') {
        return true
      }

      // Users from the clients collection can only access their own drug tests
      if (user.collection === 'clients') {
        return {
          relatedClient: {
            equals: user.id,
          },
        }
      }

      return false
    },
    update: admins,
  },
  admin: {
    defaultColumns: [
      'relatedClient',
      'testType',
      'screeningStatus',
      'collectionDate',
      'isComplete',
    ],
    description: 'Track drug test results and workflow',
    useAsTitle: 'clientName',
  },
  fields: [
    // Computed field for display title (stored in DB)
    {
      name: 'clientName',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          async ({ req, data }) => {
            if (data?.relatedClient) {
              const clientId = typeof data.relatedClient === 'string' ? data.relatedClient : data.relatedClient.id
              const client = await req.payload.findByID({
                collection: 'clients',
                id: clientId,
                depth: 0,
              })
              if (client) {
                const middleInitial = client.middleInitial ? `${client.middleInitial}. ` : ''
                return `${client.firstName} ${middleInitial}${client.lastName}`
              }
            }
            return 'Drug Test'
          },
        ],
      },
    },
    // Sidebar fields - workflow status and controls
    {
      name: 'screeningStatus',
      type: 'select',
      options: [
        { label: 'Collected (Awaiting Screening)', value: 'collected' },
        { label: 'Screened (Results Entered)', value: 'screened' },
        { label: 'Confirmation Pending', value: 'confirmation-pending' },
        { label: 'Complete', value: 'complete' },
      ],
      required: true,
      defaultValue: 'collected',
      admin: {
        description: 'AUTO-UPDATED: Current workflow status based on entered data',
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ value, siblingData }) => {
            // Auto-upgrade existing records without screeningStatus
            if (!value) {
              return siblingData?.initialScreenResult ? 'screened' : 'collected'
            }
            return value
          },
        ],
      },
    },
    {
      name: 'isInconclusive',
      type: 'checkbox',
      admin: {
        description:
          '⚠️ CRITICAL WARNING: Check this ONLY if the sample is INVALID (leaked during transport, damaged, or unable to produce results). This will immediately mark the test as COMPLETE with an INCONCLUSIVE result and send notification emails to client and referral. A new test must be scheduled.',
        position: 'sidebar',
      },
    },
    {
      name: 'initialScreenResult',
      type: 'select',
      options: [
        { label: 'Negative (PASS)', value: 'negative' },
        { label: 'Expected Positive (PASS)', value: 'expected-positive' },
        { label: 'Unexpected Positive (FAIL)', value: 'unexpected-positive' },
        { label: 'Unexpected Negative - Critical (FAIL)', value: 'unexpected-negative-critical' },
        { label: 'Unexpected Negative - Warning', value: 'unexpected-negative-warning' },
        { label: 'Mixed Unexpected (FAIL)', value: 'mixed-unexpected' },
      ],
      admin: {
        description: 'AUTO-COMPUTED: Initial screening result based on business logic',
        readOnly: true,
        position: 'sidebar',
        condition: (_, siblingData) => {
          // Hide if test is marked inconclusive or when confirmation is complete
          if (siblingData?.isInconclusive) return false

          const hadConfirmation = siblingData?.confirmationDecision === 'request-confirmation'
          const confirmationComplete =
            hadConfirmation &&
            Array.isArray(siblingData?.confirmationResults) &&
            siblingData.confirmationResults.length > 0 &&
            Array.isArray(siblingData?.confirmationSubstances) &&
            siblingData.confirmationResults.length === siblingData.confirmationSubstances.length
          return !confirmationComplete
        },
      },
    },
    {
      name: 'finalStatus',
      type: 'select',
      options: [
        { label: 'Negative (PASS)', value: 'negative' },
        { label: 'Expected Positive (PASS)', value: 'expected-positive' },
        { label: 'Confirmed Negative (PASS)', value: 'confirmed-negative' },
        { label: 'Unexpected Positive (FAIL)', value: 'unexpected-positive' },
        { label: 'Unexpected Negative - Critical (FAIL)', value: 'unexpected-negative-critical' },
        { label: 'Unexpected Negative - Warning', value: 'unexpected-negative-warning' },
        { label: 'Mixed Unexpected (FAIL)', value: 'mixed-unexpected' },
        { label: 'Inconclusive', value: 'inconclusive' },
      ],
      admin: {
        description: 'AUTO-COMPUTED: Final result after confirmation testing',
        readOnly: true,
        position: 'sidebar',
        condition: (_, siblingData) => {
          // Hide if test is marked inconclusive
          if (siblingData?.isInconclusive) return false

          // Only show when confirmation is complete
          const hadConfirmation = siblingData?.confirmationDecision === 'request-confirmation'
          const confirmationComplete =
            hadConfirmation &&
            Array.isArray(siblingData?.confirmationResults) &&
            siblingData.confirmationResults.length > 0 &&
            Array.isArray(siblingData?.confirmationSubstances) &&
            siblingData.confirmationResults.length === siblingData.confirmationSubstances.length
          return confirmationComplete
        },
      },
    },
    {
      name: 'isComplete',
      type: 'checkbox',
      admin: {
        description:
          'AUTO-COMPUTED: Complete when auto-accepted, manually accepted, or all confirmation results received',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'confirmationDecision',
      type: 'radio',
      options: [
        { label: 'Pending Decision', value: 'pending-decision' },
        { label: 'Accept Results (No Confirmation)', value: 'accept' },
        { label: 'Request Confirmation Testing', value: 'request-confirmation' },
      ],
      admin: {
        description:
          'AUTO-SELECTED as "accept" for negative/expected-positive results. For unexpected results, choose to accept as-is, request $30-45/substance confirmation, or leave pending.',
        position: 'sidebar',
      },
    },
    {
      name: 'sendNotifications',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Uncheck to skip sending email notifications when saving (useful for testing or manual corrections)',
        position: 'sidebar',
      },
    },
    // Main content organized in tabs
    {
      type: 'tabs',
      tabs: [
        // Tab 1: Basic Info
        {
          label: 'Basic Info',
          description: 'Client information, collection details, and test type',
          fields: [
            {
              name: 'relatedClient',
              type: 'relationship',
              relationTo: 'clients',
              required: true,
              admin: {
                description: 'Client this drug test belongs to',
              },
            },
            {
              name: 'collectionDate',
              type: 'date',
              admin: {
                description: 'Date and time the sample was collected',
                date: {
                  pickerAppearance: 'dayAndTime',
                },
              },
            },
            {
              name: 'testType',
              type: 'select',
              options: [
                { label: '11-Panel Lab', value: '11-panel-lab' },
                { label: '15-Panel Instant', value: '15-panel-instant' },
                { label: '17-Panel SOS Lab', value: '17-panel-sos-lab' },
                { label: 'EtG Lab', value: 'etg-lab' },
              ],
              required: true,
              admin: {
                description: 'Type of drug test panel used',
              },
            },
            {
              name: 'medicationsAtTestTime',
              type: 'text',
              access: {
                update: ({ req }) => {
                  // Only superAdmin can modify medication snapshots after creation
                  return req.user?.collection === 'admins' && req.user?.role === 'superAdmin'
                },
              },
              admin: {
                description:
                  'Snapshot of active medications at time of test (auto-populated from client, editable by superAdmin only)',
              },
              hooks: {
                beforeChange: [
                  async ({ value, siblingData, req, operation }) => {
                    // Only auto-populate on create for drug tests
                    if (operation === 'create' && siblingData?.relatedClient) {
                      try {
                        const payload = req.payload
                        const client = await payload.findByID({
                          collection: 'clients',
                          id: siblingData.relatedClient,
                          depth: 0,
                        })

                        if (client?.medications) {
                          // Get active medications and format as comma-separated string
                          const activeMeds = client.medications
                            .filter((med: any) => med.status === 'active')
                            .map((med: any) => med.medicationName)
                            .join(', ')

                          return activeMeds || 'No active medications'
                        }

                        return 'No medications on file'
                      } catch (error) {
                        console.error('Error fetching client medications:', error)
                        return 'Error fetching medications'
                      }
                    }

                    // Return existing value if already set
                    return value
                  },
                ],
              },
            },
            {
              name: 'processNotes',
              type: 'textarea',
              admin: {
                description: 'Internal process notes and status updates',
              },
            },
          ],
        },
        // Tab 2: Screening Results
        {
          label: 'Screening',
          description: 'Initial screening results and detected substances',
          fields: [
            {
              name: 'testDocument',
              type: 'relationship',
              relationTo: 'private-media',
              required: false,
              admin: {
                description:
                  'Initial screening test report (PDF). Uploading this will trigger test computation and mark status as "screened".',
              },
              filterOptions: {
                documentType: {
                  equals: 'drug-test-report',
                },
              },
            },
            {
              name: 'isDilute',
              type: 'checkbox',
              admin: {
                description: 'Mark if the test sample was dilute',
              },
            },
            {
              name: 'breathalyzerTaken',
              type: 'checkbox',
              admin: {
                description: 'Check if a breathalyzer test was administered',
              },
              defaultValue: false,
            },
            {
              name: 'breathalyzerResult',
              type: 'number',
              admin: {
                description: 'BAC result with 3 decimal places (e.g., 0.000). Any value > 0.000 is considered positive.',
                condition: (data) => data.breathalyzerTaken === true,
              },
              validate: (value, { siblingData }) => {
                if (siblingData.breathalyzerTaken && (value === null || value === undefined)) {
                  return 'Breathalyzer result is required when breathalyzer is taken'
                }
                return true
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'detectedSubstances',
                  type: 'select',
                  hasMany: true,
                  options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
                  admin: {
                    width: '100%',
                    description:
                      'RAW TEST RESULTS: Which substances tested positive? Leave empty if all negative.',
                  },
                },
              ],
            },
            {
              type: 'collapsible',
              label: 'Computed Results (Auto-Generated)',
              admin: {
                initCollapsed: false,
                description:
                  'These fields are automatically calculated based on client medications',
              },
              fields: [
                {
                  name: 'expectedPositives',
                  type: 'select',
                  hasMany: true,
                  options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
                  admin: {
                    description:
                      'AUTO-COMPUTED: Substances expected to be positive based on client medications',
                    readOnly: true,
                  },
                },
                {
                  name: 'unexpectedPositives',
                  type: 'select',
                  hasMany: true,
                  options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
                  admin: {
                    description:
                      'AUTO-COMPUTED: Substances that tested positive but were NOT expected (FAIL)',
                    readOnly: true,
                  },
                },
                {
                  name: 'unexpectedNegatives',
                  type: 'select',
                  hasMany: true,
                  options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
                  admin: {
                    description:
                      "AUTO-COMPUTED: Medications that should show positive but DIDN'T (Warning - Yellow Flag)",
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
        // Tab 3: Confirmation Testing
        {
          label: 'Confirmation',
          description: 'Confirmation testing workflow and results',
          fields: [
            {
              name: 'confirmationRequestedAt',
              type: 'date',
              admin: {
                description: 'Date and time confirmation was requested',
                condition: (_, siblingData) =>
                  siblingData?.confirmationDecision === 'request-confirmation',
                date: {
                  pickerAppearance: 'default',
                },
              },
              hooks: {
                beforeChange: [
                  ({ siblingData, value }) => {
                    // Auto-set timestamp when confirmation is requested for the first time
                    if (siblingData?.confirmationDecision === 'request-confirmation' && !value) {
                      return new Date().toISOString()
                    }
                    return value
                  },
                ],
              },
            },
            {
              name: 'confirmationDocument',
              type: 'relationship',
              relationTo: 'private-media',
              required: false,
              admin: {
                description:
                  'Confirmation test report (PDF). Shows both initial screen and confirmation results. Required before final emails are sent.',
                condition: (_, siblingData) =>
                  siblingData?.confirmationDecision === 'request-confirmation' &&
                  Array.isArray(siblingData?.confirmationResults) &&
                  siblingData.confirmationResults.length > 0,
              },
              filterOptions: {
                documentType: {
                  equals: 'drug-test-report',
                },
              },
            },
            {
              name: 'confirmationSubstances',
              type: 'select',
              options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
              hasMany: true,
              admin: {
                description: 'Which substances require confirmation testing',
                condition: (_, siblingData) =>
                  siblingData?.confirmationDecision === 'request-confirmation',
              },
            },
            {
              name: 'confirmationResults',
              type: 'array',
              admin: {
                description: 'Individual confirmation test results for each substance',
                condition: (_, siblingData) =>
                  siblingData?.confirmationDecision === 'request-confirmation' &&
                  Array.isArray(siblingData?.confirmationSubstances) &&
                  siblingData.confirmationSubstances.length > 0,
              },
              fields: [
                {
                  name: 'substance',
                  type: 'select',
                  required: true,
                  options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
                  admin: {
                    description: 'Which substance was tested in the confirmation',
                  },
                },
                {
                  name: 'result',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Confirmed Positive', value: 'confirmed-positive' },
                    { label: 'Confirmed Negative', value: 'confirmed-negative' },
                    { label: 'Inconclusive', value: 'inconclusive' },
                  ],
                  admin: {
                    description: 'Lab confirmation result for this specific substance',
                  },
                },
                {
                  name: 'notes',
                  type: 'textarea',
                  admin: {
                    description: 'Optional notes about this confirmation result',
                  },
                },
              ],
            },
          ],
        },
        // Tab 4: Notification History
        {
          label: 'Notification History',
          description: 'Email notification history and audit trail',
          fields: [
            {
              name: 'notificationsSent',
              type: 'array',
              admin: {
                readOnly: true,
                description: 'Complete history of all email notifications sent for this test',
              },
              fields: [
                {
                  name: 'stage',
                  type: 'text',
                  admin: {
                    readOnly: true,
                    description: 'Workflow stage (collected, screened, complete, inconclusive)',
                  },
                },
                {
                  name: 'sentAt',
                  type: 'date',
                  admin: {
                    readOnly: true,
                    description: 'When the notification was sent',
                    date: {
                      pickerAppearance: 'dayAndTime',
                    },
                  },
                },
                {
                  name: 'recipients',
                  type: 'textarea',
                  admin: {
                    readOnly: true,
                    description: 'Who received the notification',
                  },
                },
                {
                  name: 'status',
                  type: 'select',
                  options: [
                    { label: 'Sent', value: 'sent' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Opted Out', value: 'opted-out' },
                  ],
                  admin: {
                    readOnly: true,
                    description: 'Status of this notification',
                  },
                },
                {
                  name: 'optedOutBy',
                  type: 'text',
                  admin: {
                    readOnly: true,
                    description: 'How this email was skipped (wizard, manual-resend, etc.)',
                  },
                },
                {
                  name: 'originalRecipients',
                  type: 'textarea',
                  admin: {
                    readOnly: true,
                    description: 'Original computed recipients before any edits',
                  },
                },
                {
                  name: 'errorMessage',
                  type: 'textarea',
                  admin: {
                    readOnly: true,
                    description: 'Error message if send failed',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
