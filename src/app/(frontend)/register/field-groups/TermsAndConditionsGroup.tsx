'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { FileText } from 'lucide-react'
import { z } from 'zod'
import type { RegistrationFormType } from '../schemas/registrationSchemas'

// Export the schema for reuse in step validation
export const termsAndConditionsFieldSchema = z.object({
  agreeToTerms: z.boolean().refine((val) => val === true, {
    error: 'You must agree to the terms and conditions',
  }),
})

const defaultValues: RegistrationFormType['termsAndConditions'] = {
  agreeToTerms: false,
}
export const TermsAndConditionsGroup = withFieldGroup({
  defaultValues,
  props: {
    title: 'Terms & Conditions',
  },

  render: function Render({ group, title }) {
    return (
      <div className="space-y-6">
        <div className="flex items-center mb-6">
          <FileText className="w-6 h-6 text-primary mr-3" />
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        </div>

        <div className="bg-muted rounded-lg p-6 max-h-64 overflow-y-auto border border-border">
          <h3 className="font-semibold text-foreground mb-3">Service Agreement</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>By agreeing to these terms, you acknowledge that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All information provided is accurate and complete</li>
              <li>You consent to the drug screening procedure</li>
              <li>Test results will be shared with the designated recipient</li>
              <li>You understand the testing process and timeline</li>
              <li>Payment is required before testing can be scheduled</li>
            </ul>
            <p className="mt-3">
              Additional terms and conditions apply. Full documentation will be provided
              at the testing facility.
            </p>
          </div>
        </div>

        <group.AppField
          name="agreeToTerms"
          validators={{
            onChange: z.boolean().refine((val) => val === true, {
              message: 'You must agree to the terms and conditions to continue',
            }),
          }}
        >
          {(field) => (
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="w-5 h-5 text-primary border-border rounded focus:ring-primary mt-1"
                />
                <span className="ml-3 text-sm text-foreground">
                  I have read and agree to the terms and conditions of service
                </span>
              </label>
              {field.state.meta.errors && (
                <em className="text-destructive text-sm first:mt-2">
                  {field.state.meta.errors[0]?.message}
                </em>
              )}
            </div>
          )}
        </group.AppField>
      </div>
    )
  },
})