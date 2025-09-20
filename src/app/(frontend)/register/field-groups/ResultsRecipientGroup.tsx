'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { FileText } from 'lucide-react'
import { z } from 'zod'
import type { ResultsRecipientFields } from '../use-registration-form-opts'

const defaultValues: ResultsRecipientFields = {
  resultRecipientName: '',
  resultRecipientEmail: '',
}

export const ResultsRecipientGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Results Recipient',
  },

  render: function Render({ group, title }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <FileText className="text-primary mr-3 h-6 w-6" />
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        </div>

        <div className="bg-chart-1/20 border-chart-1/40 mb-6 rounded-lg border p-4">
          <p className="text-chart-1 text-sm">
            Please provide the contact information for the person or organization who should receive
            the test results.
          </p>
        </div>

        <group.AppField
          name="resultRecipientName"
          validators={{
            onChange: z.string().min(1, 'Recipient name is required'),
          }}
        >
          {(field) => <field.TextField label="Recipient Name" required />}
        </group.AppField>

        <group.AppField
          name="resultRecipientEmail"
          validators={{
            onChange: z
              .string()
              .min(1, 'Recipient email is required')
              .email('Please enter a valid email address'),
          }}
        >
          {(field) => <field.EmailField label="Recipient Email" required />}
        </group.AppField>
      </div>
    )
  },
})
