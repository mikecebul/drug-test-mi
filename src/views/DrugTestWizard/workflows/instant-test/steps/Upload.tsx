'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'

export const UploadStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Upload Instant Drug Test Report"
          description="Use the PDF report generated from Redwood Labs"
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
