'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { ClipboardCheck } from 'lucide-react'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { SCREENING_TYPES } from '../types'
import type { ScreeningRequestFields } from '../use-registration-form-opts'

const defaultValues: ScreeningRequestFields = {
  requestedBy: '',
}

export const ScreeningRequestGroup = withFieldGroup({
  defaultValues,
  props: {
    title: 'Screening Request',
  },

  render: function Render({ group, title }) {
    const requestedBy = useStore(group.store, (state) => state.values.requestedBy)

    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <ClipboardCheck className="text-primary mr-3 h-6 w-6" />
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        </div>

        <group.AppField
          name="requestedBy"
          validators={{
            onChange: z.enum(['probation', 'employment', 'self'], {
              message: 'Please select who is requesting this screening'
            }),
          }}
        >
          {(field) => (
            <div>
              <label className="text-foreground mb-4 block text-sm font-medium">
                Who is requesting this drug screening?
              </label>
              <div className="space-y-3">
                {SCREENING_TYPES.map((option: { value: 'probation' | 'employment' | 'self'; label: string; description: string }) => (
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
                      onChange={(e) => field.handleChange(e.target.value as 'probation' | 'employment' | 'self')}
                      className="text-primary border-border focus:ring-primary h-5 w-5"
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
          )}
        </group.AppField>
      </div>
    )
  },
})
