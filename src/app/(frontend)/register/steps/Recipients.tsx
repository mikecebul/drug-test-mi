'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { useStore } from '@tanstack/react-form'
import {
  EMPLOYER_CONFIGS,
  COURT_CONFIGS,
  isValidEmployerType,
  isValidCourtType,
} from '../configs/recipient-configs'
import type { RecipientInfo } from '../types/recipient-types'

export const RecipientsStep = withForm({
  ...getRegisterClientFormOpts('recipients'),

  render: function Render({ form }) {
    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)
    const useSelfAsRecipient = useStore(form.store, (state) => state.values.recipients.useSelfAsRecipient)
    const selectedEmployerValue = useStore(form.store, (state) => state.values.recipients.selectedEmployer)
    const selectedCourtValue = useStore(form.store, (state) => state.values.recipients.selectedCourt)

    const selectedEmployer = isValidEmployerType(selectedEmployerValue) ? selectedEmployerValue : null
    const selectedCourt = isValidCourtType(selectedCourtValue) ? selectedCourtValue : null

    const renderSelfPayFields = () => (
      <>
        <form.AppField name="recipients.useSelfAsRecipient">
          {(field) => (
            <div className="space-y-3">
              <label className="text-foreground block text-sm font-medium">Who should receive the test results?</label>
              <div className="space-y-2">
                <label
                  className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-3 transition-all ${
                    useSelfAsRecipient ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    checked={useSelfAsRecipient === true}
                    onChange={() => field.handleChange(true)}
                    className="text-primary border-border focus:ring-primary h-4 w-4"
                  />
                  <span className="text-foreground ml-3 text-sm font-medium">Send results to me</span>
                </label>
                <label
                  className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-3 transition-all ${
                    useSelfAsRecipient === false ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    checked={useSelfAsRecipient === false}
                    onChange={() => field.handleChange(false)}
                    className="text-primary border-border focus:ring-primary h-4 w-4"
                  />
                  <span className="text-foreground ml-3 text-sm font-medium">Send results to someone else</span>
                </label>
              </div>
            </div>
          )}
        </form.AppField>

        {useSelfAsRecipient === false && (
          <>
            <form.AppField name="recipients.alternativeRecipientName">
              {(field) => <field.TextField label="Recipient Name" required />}
            </form.AppField>

            <form.AppField name="recipients.alternativeRecipientEmail">
              {(field) => <field.EmailField label="Recipient Email" required />}
            </form.AppField>
          </>
        )}
      </>
    )

    const renderEmploymentFields = () => {
      const employerConfig = selectedEmployer ? EMPLOYER_CONFIGS[selectedEmployer] : null
      const requiresManualEntry = selectedEmployer === 'other'

      return (
        <>
          <form.AppField name="recipients.selectedEmployer">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
              <div className="space-y-2">
                <label htmlFor="employer-select" className="text-foreground block text-sm font-medium">
                  Select Employer <span className="text-destructive">*</span>
                </label>
                <select
                  id="employer-select"
                  value={field.state.value || ''}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  aria-invalid={hasErrors || undefined}
                  className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  <option value="">-- Select an employer --</option>
                  {Object.entries(EMPLOYER_CONFIGS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">{String(field.state.meta.errors[0]?.message)}</p>
                )}
              </div>
            )}}
          </form.AppField>

          {employerConfig && employerConfig.recipients.length > 0 && (
            <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
              <p className="text-foreground mb-2 text-sm font-medium">Results will be sent to:</p>
              <ul className="space-y-1">
                {employerConfig.recipients.map((recipient: RecipientInfo) => (
                  <li key={recipient.email} className="text-muted-foreground text-sm">
                    • {recipient.name} ({recipient.email})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {requiresManualEntry && (
            <>
              <form.AppField name="recipients.employerName">
                {(field) => <field.TextField label="Employer/Company Name" required />}
              </form.AppField>

              <form.AppField name="recipients.contactName">
                {(field) => <field.TextField label="HR Contact or Hiring Manager Name" required />}
              </form.AppField>

              <form.AppField name="recipients.contactEmail">
                {(field) => <field.EmailField label="HR Contact or Hiring Manager Email" required />}
              </form.AppField>
            </>
          )}
        </>
      )
    }

    const renderProbationFields = () => {
      const courtConfig = selectedCourt ? COURT_CONFIGS[selectedCourt] : null
      const requiresManualEntry = selectedCourt === 'other'

      return (
        <>
          <form.AppField name="recipients.selectedCourt">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
              <div className="space-y-2">
                <label htmlFor="court-select" className="text-foreground block text-sm font-medium">
                  Select Court <span className="text-destructive">*</span>
                </label>
                <select
                  id="court-select"
                  value={field.state.value || ''}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  aria-invalid={hasErrors || undefined}
                  className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  <option value="">-- Select a court --</option>
                  {Object.entries(COURT_CONFIGS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">{String(field.state.meta.errors[0]?.message)}</p>
                )}
              </div>
            )}}
          </form.AppField>

          {courtConfig && courtConfig.recipients.length > 0 && (
            <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
              <p className="text-foreground mb-2 text-sm font-medium">Results will be sent to:</p>
              <ul className="space-y-1">
                {courtConfig.recipients.map((recipient: RecipientInfo) => (
                  <li key={recipient.email} className="text-muted-foreground text-sm">
                    • {recipient.name} ({recipient.email})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {requiresManualEntry && (
            <>
              <form.AppField name="recipients.courtName">
                {(field) => <field.TextField label="Court Name" required />}
              </form.AppField>

              <form.AppField name="recipients.probationOfficerName">
                {(field) => <field.TextField label="Probation Officer Name" required />}
              </form.AppField>

              <form.AppField name="recipients.probationOfficerEmail">
                {(field) => <field.EmailField label="Probation Officer Email" required />}
              </form.AppField>
            </>
          )}
        </>
      )
    }

    const getDescription = () => {
      switch (requestedBy) {
        case 'self':
          return 'Choose who should receive your test results. You can have them sent to yourself or to someone else.'
        case 'employment':
          return "Please provide your employer's information so we can send the test results directly to them."
        case 'probation':
          return 'Please provide your court and probation officer information so we can send the test results to the appropriate authorities.'
        default:
          return 'Please select who is requesting this screening first to see the appropriate recipient options.'
      }
    }

    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Results Recipient</h2>
        </div>

        <div className="bg-chart-1/20 border-chart-1/40 mb-6 rounded-lg border p-4">
          <p className="text-chart-1 text-sm">{getDescription()}</p>
        </div>

        {requestedBy === 'self' && renderSelfPayFields()}
        {requestedBy === 'employment' && renderEmploymentFields()}
        {requestedBy === 'probation' && renderProbationFields()}

        {!requestedBy && (
          <div className="bg-muted/50 border-muted rounded-lg border p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Please select who is requesting this screening in the previous step to configure the results recipient.
            </p>
          </div>
        )}
      </div>
    )
  },
})
