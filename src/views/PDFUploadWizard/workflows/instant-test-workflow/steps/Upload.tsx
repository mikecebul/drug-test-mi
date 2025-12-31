'use client'

import { useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { clearFileStorage, hasStoredFile } from '../utils/fileStorage'

export const UploadStep = withForm({
  ...getInstantTestFormOpts('upload'),

  render: function Render({ form }) {
    // Defensively clear any stale files from localStorage when starting fresh
    useEffect(() => {
      if (hasStoredFile() && !form.state.values.upload.file) {
        clearFileStorage()
      }
    }, [form.state.values.upload.file])

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Upload 15 Panel Drug Test Report"
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
