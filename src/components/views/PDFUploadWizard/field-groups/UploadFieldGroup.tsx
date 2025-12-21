'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { z } from 'zod'
import type { PdfUploadFormType } from '../schemas/pdfUploadSchemas'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { wizardContainerStyles } from '../styles'
import { cn } from '@/utilities/cn'
import { WIZARD_OPTIONS } from '../types'

// Export the schema for reuse in step validation
export const uploadFieldSchema = z.object({
  wizardType: z.enum([
    '15-panel-instant',
    'collect-lab',
    'enter-lab-screen',
    'enter-lab-confirmation',
  ]),
  file: z.instanceof(File, { message: 'Please upload a PDF file' }),
})

const defaultValues: PdfUploadFormType['uploadData'] = {
  wizardType: '15-panel-instant' as const,
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
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />

        <div className={cn(wizardContainerStyles.fields, 'text-base md:text-lg')}>
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
      </div>
    )
  },
})
