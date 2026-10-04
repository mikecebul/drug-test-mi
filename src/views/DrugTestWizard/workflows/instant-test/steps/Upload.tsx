'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getInstantTestFormOpts } from '../shared-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsString } from 'nuqs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { ReportPreparation } from '../../../components/ReportPreparation'

export const UploadStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
    const [bookingId] = useQueryState('bookingId', parseAsString)
    const client = useStore(form.store, (state) => state.values.client)
    const file = useStore(form.store, (state) => state.values.upload.file)
    const upload = (
      <form.AppField name="upload.file">
        {(field) => (
          <field.FileUploadField
            reportStyle
            accept="application/pdf"
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            required
          />
        )}
      </form.AppField>
    )
    return (
      <div className="flex flex-col gap-6">
        {client.id && (
          <ClientDetailsCard
            compact
            client={client}
            editable
            testLabel="17-Panel Instant"
            onClientUpdated={(updated) => {
              if (updated.firstName !== undefined) form.setFieldValue('client.firstName', updated.firstName)
              if (updated.middleInitial !== undefined) form.setFieldValue('client.middleInitial', updated.middleInitial)
              if (updated.lastName !== undefined) form.setFieldValue('client.lastName', updated.lastName)
              if (updated.email !== undefined) form.setFieldValue('client.email', updated.email)
              if (updated.dob !== undefined) form.setFieldValue('client.dob', updated.dob)
              if (updated.phone !== undefined) form.setFieldValue('client.phone', updated.phone)
              if (updated.gender !== undefined) form.setFieldValue('client.gender', updated.gender)
              if (updated.headshot !== undefined) form.setFieldValue('client.headshot', updated.headshot)
              if (updated.headshotId !== undefined) form.setFieldValue('client.headshotId', updated.headshotId)
              if (updated.referralType !== undefined) form.setFieldValue('client.referralType', updated.referralType)
              if (updated.referralTitle !== undefined) form.setFieldValue('client.referralTitle', updated.referralTitle)
            }}
          />
        )}
        <FieldGroupHeader title={bookingId ? 'Generate & upload report' : 'Upload instant report'} />
        {bookingId && client.id ? (
          <ReportPreparation clientId={client.id} hasReport={Boolean(file)}>
            {upload}
          </ReportPreparation>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Report PDF</CardTitle>
            </CardHeader>
            <CardContent>{upload}</CardContent>
          </Card>
        )}
      </div>
    )
  },
})
