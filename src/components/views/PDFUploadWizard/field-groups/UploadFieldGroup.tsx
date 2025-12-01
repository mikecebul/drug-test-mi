'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Upload as UploadIcon } from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'

// Export the schema for reuse in step validation
export const uploadFieldSchema = z.object({
  testType: z.enum(['15-panel-instant', '11-panel-lab']),
  file: z.instanceof(File, { message: 'Please upload a PDF file' }),
})

const defaultValues: PdfUploadFormType['uploadData'] = {
  testType: '15-panel-instant' as const,
  file: null as any,
}

export const UploadFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Upload Drug Test PDF',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <group.AppField
          name="file"
          validators={{
            onChange: ({ value }) => {
              const result = uploadFieldSchema.shape.file.safeParse(value)
              if (!result.success) {
                return result.error.issues[0]?.message || 'Please upload a PDF file'
              }
              return undefined
            },
          }}
        >
          {(field) => (
            <field.FileUploadField
              label="Drug Test PDF"
              description="PDF files up to 10MB"
              accept="application/pdf"
              maxFiles={1}
              maxSize={10 * 1024 * 1024}
              required
            />
          )}
        </group.AppField>
      </div>
    )
  },
})
