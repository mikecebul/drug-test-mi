'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getLabScreenFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'

export const UploadStep = withForm({
  ...getLabScreenFormOpts('upload'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Upload Lab Screening Results PDF"
          description="Upload the PDF report from the laboratory"
        />
        <form.AppField name="upload.file">
          {(field) => (
            <field.FileUploadField
              accept="application/pdf"
              maxFiles={1}
              maxSize={10 * 1024 * 1024}
              required
            />
          )}
        </form.AppField>
      </div>
    )
  },
})
