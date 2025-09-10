import deepMerge from '@/utilities/deepMerge'
import type { Field, GroupField } from 'payload'

type ContactGroupType = (options?: { overrides?: Partial<GroupField> }) => Field

const contactInfo: ContactGroupType = ({ overrides = {} }: { overrides?: Partial<GroupField> }) => {
  const contactsField: Field = {
    name: 'contact',
    type: 'group',
    admin: {
      hideGutter: true,
      description: 'Company contact information.',
    },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'phone',
            label: 'Phone Number',
            type: 'text',
            defaultValue: '(231) 547-1144',
            admin: { width: '45%' },
          },
          {
            name: 'fax',
            label: 'Fax',
            type: 'text',
            defaultValue: '(231) 547-4970',
            admin: { width: '45%' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'address',
            label: 'Address',
            type: 'text',
            defaultValue: '210 State Street, Suite D | Charlevoix, MI',
            admin: { width: '45%' },
          },
          {
            name: 'googleMapLink',
            type: 'text',
            label: 'Google Map Link',
            defaultValue: 'https://maps.app.goo.gl/Epxr8RtaEqaTyxSV9',
            admin: { width: '45%' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'email',
            label: 'Email',
            type: 'text',
            defaultValue: 'mike@drugtestmi.com',
            admin: { width: '45%' },
          },
        ],
      },
    ],
  }
  return deepMerge(contactsField, overrides)
}

export default contactInfo
