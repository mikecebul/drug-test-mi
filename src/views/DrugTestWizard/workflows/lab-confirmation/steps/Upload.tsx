'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getLabConfirmationFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components'

export const UploadStep = withForm({
  ...getLabConfirmationFormOpts('upload'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Upload Confirmation PDF"
          description="Upload the laboratory confirmation report (LC-MS/MS)"
        />
        <form.AppField name="upload.file">{(field) => <field.FileUploadField />}</form.AppField>
      </div>
    )
  },
})
