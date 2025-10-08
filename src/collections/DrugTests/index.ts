import { CollectionConfig } from 'payload'
import { superAdmin } from '@/access/superAdmin'
import { admins } from '@/access/admins'
import { computeTestResults } from './hooks/computeTestResults'
import { allSubstanceOptions } from '@/fields/substanceOptions'

export const DrugTests: CollectionConfig = {
  slug: 'drug-tests',
  labels: {
    singular: 'Drug Test',
    plural: 'Drug Tests',
  },
  hooks: {
    beforeChange: [computeTestResults],
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
      'initialScreenResult',
      'collectionDate',
      'isComplete',
    ],
    description: 'Track drug test results and workflow',
    useAsTitle: 'relatedClient',
  },
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
      ],
      required: true,
      admin: {
        description: 'Type of drug test panel used',
      },
    },
    // Raw test results - what substances were detected
    {
      name: 'detectedSubstances',
      type: 'select',
      hasMany: true,
      options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
      admin: {
        description:
          'RAW TEST RESULTS: Which substances tested positive? Leave empty if all negative. Select only substances that appear on your specific test panel.',
      },
    },
    // Computed fields - automatically populated by business logic hook
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
        description: 'AUTO-COMPUTED: Substances that tested positive but were NOT expected (FAIL)',
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
          "AUTO-COMPUTED: Medications that should show positive but DIDN'T (FAIL - Red Flag)",
        readOnly: true,
      },
    },
    // Overall result classification
    {
      name: 'initialScreenResult',
      type: 'select',
      options: [
        { label: 'Negative (PASS)', value: 'negative' },
        { label: 'Expected Positive (PASS)', value: 'expected-positive' },
        { label: 'Unexpected Positive (FAIL)', value: 'unexpected-positive' },
        { label: 'Unexpected Negative (FAIL - Red Flag)', value: 'unexpected-negative' },
        { label: 'Mixed Unexpected (FAIL)', value: 'mixed-unexpected' },
        { label: 'Inconclusive', value: 'inconclusive' },
      ],
      admin: {
        description: 'AUTO-COMPUTED: Overall test result classification based on business logic',
        readOnly: true,
        position: 'sidebar',
      },
    },
    // Confirmation workflow - always visible for one-save workflow
    {
      name: 'confirmationDecision',
      type: 'radio',
      options: [
        { label: 'Accept Results (No Confirmation Needed)', value: 'accept' },
        { label: 'Request Confirmation Testing', value: 'request-confirmation' },
      ],
      admin: {
        description:
          'AUTO-SELECTED as "accept" for negative/expected-positive results. REQUIRED CHOICE for unexpected results.',
        position: 'sidebar',
      },
    },
    {
      name: 'confirmationRequestedAt',
      type: 'date',
      admin: {
        description: 'Date and time confirmation was requested',
        condition: (_, siblingData) => siblingData?.confirmationDecision === 'request-confirmation',
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
      name: 'confirmationSubstances',
      type: 'select',
      options: allSubstanceOptions.filter((opt) => opt.value !== 'none') as any,
      hasMany: true,
      admin: {
        description: 'Which substances require confirmation testing',
        condition: (_, siblingData) => siblingData?.confirmationDecision === 'request-confirmation',
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
    // Auto-computed field - determines if test is complete
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
    {
      name: 'testDocument',
      type: 'relationship',
      relationTo: 'private-media',
      required: false,
      admin: {
        description: 'Drug test report document (PDF)',
        position: 'sidebar',
      },
      filterOptions: {
        documentType: {
          equals: 'drug-test-report',
        },
      },
    },
  ],
}
