'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { WizardSection } from '../components/WizardSection'

// Export the schema for reuse in step validation
export const uploadFieldSchema = z.object({
  file: z.instanceof(File, { message: 'Please upload a PDF file' }),
})

const defaultValues: PdfUploadFormType['uploadData'] = {
  file: null as any,
}

export const BaseUploadFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Upload Drug Test PDF',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    return (
      <WizardSection>
        <FieldGroupHeader title={title} description={description} />

        <div className="space-y-6 text-base md:text-lg">
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
      </WizardSection>
    )
  },
})
