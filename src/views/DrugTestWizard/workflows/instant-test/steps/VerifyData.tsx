'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InputDateTimePicker from '@/components/input-datetime-picker'
import { FieldGroupHeader } from '../../components'
import { ClientDetailsCard } from '../../components/client/ClientDetailsCard'
import { getInstantTestFormOpts } from '../shared-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldError, FieldLegend } from '@/components/ui/field'
import { useComputeTestResultPreviewQuery } from '../../../queries'
import { formatSubstance } from '@/lib/substances'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { OptionalDetails } from '../../../components/OptionalDetails'
import { CollectionResultStrip } from '../../../components/CollectionResultStrip'
import { ReportLink } from '../../../components/ReportLink'

export const VerifyDataStep = withForm({
  ...getInstantTestFormOpts(),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const formClient = formValues.client
    const verifyData = formValues.verifyData
    const medications = formValues.medications

    // Convert form client to SimpleClient type with derived fields
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

    // Compute test result preview to detect unexpected positives
    const {
      data: preview,
      isFetching,
      isError,
    } = useComputeTestResultPreviewQuery(
      client?.id,
      (verifyData?.detectedSubstances ?? []) as SubstanceValue[],
      verifyData?.testType ?? '17-panel-instant',
      verifyData?.breathalyzerTaken,
      verifyData?.breathalyzerResult,
      medications, // Pass medications to properly compute expected vs unexpected positives
    )

    const hasUnexpectedPositives = (preview?.unexpectedPositives?.length ?? 0) > 0
    const requiresDecision = hasUnexpectedPositives && !preview?.autoAccept
    // Clear error if no decision required
    useEffect(() => {
      if (!preview || isFetching || isError) return
      if (requiresDecision === true) {
        form.setFieldValue('verifyData.confirmationDecisionRequired', true)
        form.validate('submit')
      }
      if (requiresDecision === false) {
        form.setFieldValue('verifyData.confirmationDecisionRequired', false)
        form.setFieldValue('verifyData.confirmationDecision', undefined)
        form.setFieldValue('verifyData.confirmationSubstances', [])
        form.validate('submit')
      }
    }, [requiresDecision, form, preview, isFetching, isError])

    // Get confirmation decision from form state
    const confirmationDecisionValue = verifyData?.confirmationDecision
    const confirmationSubstancesValue = verifyData?.confirmationSubstances ?? []

    // Handler for confirmation decision changes
    const handleConfirmationDecisionChange = (value: 'accept' | 'request-confirmation' | 'pending-decision') => {
      form.setFieldValue('verifyData.confirmationDecision', value, { dontValidate: true })

      // Auto-populate confirmation substances when requesting confirmation
      if (value === 'request-confirmation' && preview?.unexpectedPositives) {
        const currentSubstances = confirmationSubstancesValue || []
        if (currentSubstances.length === 0) {
          form.setFieldValue('verifyData.confirmationSubstances', preview.unexpectedPositives, { dontValidate: true })
        }
      }

      // Ensure submit-mode errors clear immediately after user correction.
      form.validate('submit')
    }

    const [changeSubstances, setChangeSubstances] = useState(false)
    const detailsInvalid = useStore(form.store, (state) =>
      Object.entries(state.fieldMeta).some(
        ([name, meta]) =>
          name.startsWith('verifyData.') && !name.includes('confirmation') && Boolean(meta?.errors.length),
      ),
    )
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
        <FieldGroupHeader title="Verify instant test" />

        <CollectionResultStrip
          preview={preview}
          detected={verifyData.detectedSubstances}
          isLoading={isFetching}
          error={isError}
          isDilute={verifyData.isDilute}
          breathalyzerTaken={verifyData.breathalyzerTaken}
          breathalyzerResult={verifyData.breathalyzerResult}
          action={<ReportLink file={formValues.upload.file} />}
        />
        {requiresDecision && (
          <FieldSet>
            <FieldLegend>Result decision</FieldLegend>
            <form.Field name="verifyData.confirmationDecision">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <RadioGroup
                    value={confirmationDecisionValue || ''}
                    onValueChange={(value) =>
                      handleConfirmationDecisionChange(value as 'accept' | 'request-confirmation' | 'pending-decision')
                    }
                    className="flex flex-wrap gap-6"
                    aria-label="Result decision"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    {(
                      [
                        { value: 'accept', label: 'Accept result' },
                        { value: 'request-confirmation', label: 'Request confirmation' },
                        { value: 'pending-decision', label: 'Decide later' },
                      ] as const
                    ).map((option) => (
                      <Label key={option.value} htmlFor={option.value} className="flex items-center gap-3">
                        <RadioGroupItem id={option.value} value={option.value} />
                        {option.label}
                      </Label>
                    ))}
                  </RadioGroup>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            {confirmationDecisionValue === 'accept' && (
              <p className="text-muted-foreground text-sm">
                Accept as final. First-time unexpected failures are retained for 14 days for later confirmation.
              </p>
            )}
            {confirmationDecisionValue === 'pending-decision' && (
              <p className="text-muted-foreground text-sm">
                Sample held for 30 days. Confirmation costs $30 per substance.
              </p>
            )}
            {confirmationDecisionValue === 'request-confirmation' && (
              <form.Field name="verifyData.confirmationSubstances">
                {(field) => {
                  const invalid = field.state.meta.errors.length > 0 || confirmationSubstancesValue.length === 0
                  return (
                    <Field data-invalid={invalid}>
                      <div className="flex flex-wrap items-center gap-4">
                        <span>
                          {confirmationSubstancesValue.length === preview?.unexpectedPositives.length
                            ? 'Confirm all unexpected substances'
                            : 'Confirm: ' +
                              confirmationSubstancesValue.map((value) => formatSubstance(value)).join(', ')}
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setChangeSubstances((value) => !value)}
                          aria-expanded={changeSubstances || invalid}
                        >
                          Change
                        </Button>
                      </div>
                      {(changeSubstances || invalid) && (
                        <ConfirmationSubstanceSelector
                          unexpectedPositives={preview?.unexpectedPositives ?? []}
                          selectedSubstances={confirmationSubstancesValue}
                          onSelectionChange={(substances) => {
                            form.setFieldValue('verifyData.confirmationSubstances', substances)
                            form.validate('submit')
                          }}
                          invalid={invalid}
                        />
                      )}
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )
                }}
              </form.Field>
            )}
          </FieldSet>
        )}
        <OptionalDetails invalid={detailsInvalid}>
          <FieldGroup className="grid @lg:grid-cols-2">
            <form.Field name="verifyData.testType">
              {(field) => {
                const hasErrors = field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={hasErrors} className="@lg:col-span-1">
                    <FieldLabel htmlFor="instant-test-type">Test Type</FieldLabel>
                    <Input id="instant-test-type" value="17-Panel Instant" readOnly aria-invalid={hasErrors} />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>

          {/* Collection Date/Time */}
          <FieldGroup className="grid @lg:grid-cols-2">
            <form.Field name="verifyData.collectionDate">
              {(field) => {
                const hasErrors = field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={hasErrors} className="@lg:col-span-1">
                    <FieldLabel htmlFor="collectionDate">Collection Date &amp; Time</FieldLabel>
                    <InputDateTimePicker
                      id="collectionDate"
                      value={field.state.value ? new Date(field.state.value) : undefined}
                      onChange={(value) => field.handleChange(value?.toISOString() ?? '')}
                      aria-invalid={hasErrors}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>

          {/* Detected Substances */}
          <form.AppField
            name="verifyData.detectedSubstances"
            listeners={{
              onChange: () => {
                // Reset confirmation decision when detected substances change
                // This ensures the user makes a fresh decision when test results change
                if (confirmationDecisionValue) {
                  form.setFieldValue('verifyData.confirmationDecision', undefined)
                  form.setFieldValue('verifyData.confirmationSubstances', [])
                }
              },
            }}
          >
            {(field) => <field.SubstanceChecklistField testType={verifyData?.testType ?? '17-panel-instant'} />}
          </form.AppField>

          {/* Dilute Sample */}
          <Field orientation="horizontal">
            <form.Field name="verifyData.isDilute">
              {(field) => (
                <Checkbox
                  id="isDilute"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked as boolean)}
                />
              )}
            </form.Field>
            <FieldLabel htmlFor="isDilute" className="cursor-pointer font-normal">
              Sample is Dilute
            </FieldLabel>
          </Field>

          {/* Breathalyzer Section */}
          <div className="bg-muted/50 border-border space-y-4 rounded-lg border p-4">
            <FieldLegend>Breathalyzer Test (Optional)</FieldLegend>
            <Field orientation="horizontal">
              <form.Field name="verifyData.breathalyzerTaken">
                {(field) => (
                  <Checkbox
                    id="breathalyzerTaken"
                    checked={field.state.value}
                    onCheckedChange={(checked) => {
                      field.handleChange(checked as boolean)
                      // Clear result when unchecking - validation errors clear automatically
                      if (!checked) {
                        form.setFieldValue('verifyData.breathalyzerResult', null)
                      }
                    }}
                  />
                )}
              </form.Field>
              <FieldLabel htmlFor="breathalyzerTaken" className="cursor-pointer font-normal">
                Breathalyzer test was administered
              </FieldLabel>
            </Field>

            {verifyData?.breathalyzerTaken && (
              <form.Field name="verifyData.breathalyzerResult">
                {(field) => {
                  const hasErrors = field.state.meta.errors.length > 0

                  return (
                    <Field data-invalid={hasErrors}>
                      <FieldLabel htmlFor="breathalyzerResult">
                        BAC Result <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="breathalyzerResult"
                        type="number"
                        step="0.001"
                        value={field.state.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          field.handleChange(value)
                        }}
                        placeholder="0.000"
                        aria-invalid={hasErrors}
                      />
                      <p className="text-muted-foreground text-xs">
                        Enter result with 3 decimal places. Threshold: 0.000 (any detectable alcohol = positive)
                      </p>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )
                }}
              </form.Field>
            )}
          </div>
        </OptionalDetails>
      </div>
    )
  },
})
