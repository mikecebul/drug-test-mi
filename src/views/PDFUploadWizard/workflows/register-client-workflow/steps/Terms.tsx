'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { AlertCircle, FileCheck, Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { FieldError } from '@/components/ui/field'

export const TermsStep = withForm({
  ...getRegisterClientFormOpts('terms'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Terms & Conditions" description="Review and confirm" />

        <div className="bg-muted border-border overflow-y-auto rounded-lg border p-6">
          <h3 className="text-foreground mb-3 font-semibold">Admin Registration Agreement</h3>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>By registering this client on their behalf, you confirm that:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The client has been informed about the drug screening process</li>
              <li>The client consents to drug testing and result sharing</li>
              <li>All information provided is accurate and complete</li>
              <li>
                Test results will be shared with the designated recipient according to the configuration in previous
                steps
              </li>
              <li>The client understands the testing process and timeline</li>
            </ul>
            <p className="mt-3">
              This is an administrative registration. The client can log in later to manage their account and
              preferences.
            </p>
          </div>
        </div>

        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Client Consent Required</AlertTitle>
          <AlertDescription>
            By completing this registration, you confirm that the client has been properly informed and consents to
            testing.
          </AlertDescription>
        </Alert>

        <form.AppField name="terms.agreeToTerms">
          {(field) => (
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="text-primary border-border focus:ring-primary mt-1 h-5 w-5 rounded"
                />
                <span className="text-foreground ml-3 text-sm">
                  I confirm the client has been informed and consents to testing
                </span>
              </label>
              <FieldError errors={field.state.meta.errors} className="mt-2" />
            </div>
          )}
        </form.AppField>
      </div>
    )
  },
})
