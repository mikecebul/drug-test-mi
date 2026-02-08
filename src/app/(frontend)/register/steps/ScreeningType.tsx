'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { SCREENING_TYPES } from '../types'
import { useStore } from '@tanstack/react-form'

export const ScreeningTypeStep = withForm({
  ...getRegisterClientFormOpts('screeningType'),

  render: function Render({ form }) {
    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)

    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Screening Request</h2>
        </div>

        <form.AppField name="screeningType.requestedBy">
          {(field) => {
            const hasErrors = field.state.meta.errors.length > 0
            return (
            <div>
              <label className="text-foreground mb-4 block text-sm font-medium">
                Who is requesting this drug screening?
              </label>
              <div className="space-y-3">
                {SCREENING_TYPES.map((option) => (
                  <label
                    key={option.value}
                    className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-4 transition-all ${
                      requestedBy === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      checked={requestedBy === option.value}
                      onChange={(e) => field.handleChange(e.target.value as (typeof SCREENING_TYPES)[number]['value'])}
                      className="text-primary border-border focus:ring-primary h-5 w-5"
                      aria-invalid={hasErrors || undefined}
                    />
                    <div className="ml-3">
                      <span className="text-foreground text-base font-medium">{option.label}</span>
                      <p className="text-muted-foreground text-sm">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {field.state.meta.errors && (
                <em className="text-destructive text-sm first:mt-2">
                  {field.state.meta.errors[0]?.message}
                </em>
              )}
            </div>
          )}}
        </form.AppField>
      </div>
    )
  },
})
