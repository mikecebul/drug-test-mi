'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@tanstack/react-form'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { getCollectLabFormOpts } from '../shared-form'
import { CollectionDetailsDrawer } from '../components/CollectionDetailsDrawer'
import { collectionDateLabel, LAB_TEST_LABELS } from '../collection-details'

export const CollectionStep = withForm({
  ...getCollectLabFormOpts(),

  render: function Render({ form }) {
    const breathalyzerTaken = useStore(form.store, (state) => state.values.collection.breathalyzerTaken)

    const collectionDateValue = useStore(form.store, (state) => state.values.collection.collectionDate)

    // Access client for the editable info card
    const formClient = useStore(form.store, (state) => state.values.client)
    const client = formClient?.id
      ? {
          ...formClient,
          middleInitial: formClient.middleInitial ?? undefined,
          dob: formClient.dob ?? undefined,
          headshot: formClient.headshot ?? undefined,
          headshotId: formClient.headshotId ?? undefined,
          fullName: formClient.middleInitial
            ? `${formClient.firstName} ${formClient.middleInitial} ${formClient.lastName}`
            : `${formClient.firstName} ${formClient.lastName}`,
          initials: `${formClient.firstName.charAt(0)}${formClient.lastName.charAt(0)}`,
        }
      : undefined

    const [editorOpen, setEditorOpen] = useState(false)
    const invalidField = useStore(form.store, (state) =>
      state.fieldMeta['collection.testType']?.errors.length
        ? ('testType' as const)
        : state.fieldMeta['collection.collectionDate']?.errors.length
          ? ('collectionDate' as const)
          : undefined,
    )
    useEffect(() => {
      if (invalidField) setEditorOpen(true)
    }, [invalidField])
    const selectedType = useStore(form.store, (state) => state.values.collection.testType)
    return (
      <div className="flex flex-col gap-6">
        {client && (
          <ClientDetailsCard
            compact
            client={client}
            editable
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
        <FieldGroupHeader title="Confirm lab collection" />

        <Card size="sm" data-testid="lab-collection-details">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="font-bold">Test details</CardTitle>
            <CollectionDetailsDrawer
              value={{ testType: selectedType, collectionDate: collectionDateValue }}
              open={editorOpen}
              onOpenChange={setEditorOpen}
              invalidField={invalidField}
              onApply={(details) => {
                form.setFieldValue('collection.testType', details.testType)
                form.setFieldValue('collection.collectionDate', details.collectionDate)
              }}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm">
              <form.Field name="collection.testType">
                {(field) => (
                  <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="text-muted-foreground">Test type:</dt>
                    <dd className="font-semibold">
                      {LAB_TEST_LABELS[field.state.value]}
                      <FieldError errors={field.state.meta.errors} />
                    </dd>
                  </div>
                )}
              </form.Field>
              <form.Field name="collection.collectionDate">
                {(field) => (
                  <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="text-muted-foreground">Collection date:</dt>
                    <dd className="font-semibold">
                      {collectionDateLabel(field.state.value)}
                      <FieldError errors={field.state.meta.errors} />
                    </dd>
                  </div>
                )}
              </form.Field>
            </dl>
            <Badge variant="info" className="self-start">
              Awaiting lab results
            </Badge>
            <Separator />
            <FieldGroup className="gap-4">
              <form.Field name="collection.breathalyzerTaken">
                {(field) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="breathalyzerTaken"
                      checked={field.state.value}
                      onCheckedChange={(checked) => {
                        field.handleChange(checked === true)
                        if (checked !== true) form.setFieldValue('collection.breathalyzerResult', null)
                      }}
                    />
                    <FieldLabel htmlFor="breathalyzerTaken">Does the client need a PBT?</FieldLabel>
                  </Field>
                )}
              </form.Field>
              {breathalyzerTaken && (
                <form.Field name="collection.breathalyzerResult">
                  {(field) => (
                    <Field className="max-w-sm" data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor="breathalyzerResult">BAC result</FieldLabel>
                      <Input
                        id="breathalyzerResult"
                        name="collection.breathalyzerResult"
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={field.state.value ?? ''}
                        onChange={(event) =>
                          field.handleChange(event.target.value === '' ? null : event.target.valueAsNumber)
                        }
                        placeholder="0.000"
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby="breathalyzer-result-error"
                      />
                      <FieldError id="breathalyzer-result-error" errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    )
  },
})
