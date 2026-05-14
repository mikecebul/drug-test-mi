'use client'

import { useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { getInstantTestFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { clearFileStorage, hasStoredFile } from '../utils/fileStorage'

export const UploadStep = withForm({
  ...getInstantTestFormOpts('upload'),

  render: function Render({ form }) {
    const testType = useStore(form.store, (state) => state.values.verifyData.testType)
    const panelLabel = testType === '17-panel-instant' ? '17 Panel' : '15 Panel'

    // Defensively clear any stale files from localStorage when starting fresh
    useEffect(() => {
      if (hasStoredFile() && !form.state.values.upload.file) {
        clearFileStorage()
      }
    }, [form.state.values.upload.file])

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title={`Upload ${panelLabel} Drug Test Report`}
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
