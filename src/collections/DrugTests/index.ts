import { CollectionConfig } from 'payload'
import { superAdmin } from '@/access/superAdmin'
import { admins } from '@/access/admins'

export const DrugTests: CollectionConfig = {
  slug: 'drug-tests',
  labels: {
    singular: 'Drug Test',
    plural: 'Drug Tests',
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
    defaultColumns: ['relatedClient', 'testType', 'initialScreenResult', 'collectionDate', 'isComplete'],
    group: 'Admin',
    description: 'Track drug test results and workflow',
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
      admin: {
        description: 'Type of drug test panel used',
      },
    },
    {
      name: 'initialScreenResult',
      type: 'select',
      options: [
        { label: 'Negative', value: 'negative' },
        { label: 'Expected Positive', value: 'expected-positive' },
        { label: 'Unexpected Positive', value: 'unexpected-positive' },
        { label: 'Inconclusive', value: 'inconclusive' },
      ],
      admin: {
        description: 'Result of the initial drug screen',
      },
    },
    {
      name: 'presumptivePositive',
      type: 'select',
      options: [
        { label: 'Amphetamines', value: 'amphetamines' },
        { label: 'Methamphetamines', value: 'methamphetamines' },
        { label: 'Benzodiazepines', value: 'benzodiazepines' },
        { label: 'THC (Marijuana)', value: 'thc' },
        { label: 'Opiates', value: 'opiates' },
        { label: 'Oxycodone', value: 'oxycodone' },
        { label: 'Cocaine', value: 'cocaine' },
        { label: 'Phencyclidine (PCP)', value: 'pcp' },
        { label: 'Barbiturates', value: 'barbiturates' },
        { label: 'Methadone', value: 'methadone' },
        { label: 'Propoxyphene', value: 'propoxyphene' },
        { label: 'Tricyclic Antidepressants', value: 'tricyclic_antidepressants' },
        { label: 'MDMA (Ecstasy)', value: 'mdma' },
        { label: 'Buprenorphine', value: 'buprenorphine' },
        { label: 'Tramadol', value: 'tramadol' },
        { label: 'Fentanyl', value: 'fentanyl' },
        { label: 'Kratom', value: 'kratom' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'What substance tested positive (required for positive results)',
        condition: (_, siblingData) =>
          siblingData?.initialScreenResult &&
          ['expected-positive', 'unexpected-positive'].includes(siblingData.initialScreenResult),
      },
    },
    // Confirmation workflow - shows for positive results
    {
      name: 'confirmationDecision',
      type: 'radio',
      options: [
        { label: 'Accept Results (No Confirmation Needed)', value: 'accept' },
        { label: 'Request Confirmation Testing', value: 'request-confirmation' },
      ],
      admin: {
        description: 'Client decision on whether to accept results or request confirmation',
        condition: (_, siblingData) =>
          siblingData?.initialScreenResult &&
          ['expected-positive', 'unexpected-positive'].includes(siblingData.initialScreenResult),
      },
    },
    {
      name: 'confirmationRequestedAt',
      type: 'date',
      admin: {
        description: 'Date and time confirmation was requested by client',
        condition: (_, siblingData) =>
          siblingData?.confirmationDecision === 'request-confirmation',
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true, // Set automatically when client requests
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
      name: 'confirmationStatus',
      type: 'select',
      options: [
        { label: 'Pending Confirmation', value: 'pending-confirmation' },
        { label: 'Confirmed Positive', value: 'confirmed-positive' },
        { label: 'Confirmed Negative', value: 'confirmed-negative' },
        { label: 'Confirmation Inconclusive', value: 'confirmation-inconclusive' },
      ],
      admin: {
        description: 'Status of the confirmation test (updated when results come back)',
        condition: (_, siblingData) =>
          siblingData?.confirmationDecision === 'request-confirmation',
      },
    },
    // Virtual field - automatically determines if test is complete
    {
      name: 'isComplete',
      type: 'checkbox',
      admin: {
        description:
          'Automatically determined: complete when results are accepted or confirmation received',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            const initialResult = siblingData?.initialScreenResult
            const confirmationDecision = siblingData?.confirmationDecision
            const confirmationStatus = siblingData?.confirmationStatus

            // Complete if:
            // 1. Negative or inconclusive result (no decision needed)
            // 2. Positive result and client accepted
            // 3. Positive result, confirmation requested, and confirmation received
            if (!initialResult) return false

            // Negative or inconclusive = complete
            if (['negative', 'inconclusive'].includes(initialResult)) {
              return true
            }

            // Positive results
            if (['expected-positive', 'unexpected-positive'].includes(initialResult)) {
              // If client accepted results
              if (confirmationDecision === 'accept') {
                return true
              }

              // If confirmation requested and results received
              if (
                confirmationDecision === 'request-confirmation' &&
                confirmationStatus &&
                confirmationStatus !== 'pending-confirmation'
              ) {
                return true
              }
            }

            return false
          },
        ],
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
            if (
              operation === 'create' &&
              siblingData?.relatedClient
            ) {
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
        description: 'Drug test report document',
      },
      filterOptions: {
        documentType: {
          equals: 'drug-test-report',
        },
      },
    },
  ],
}