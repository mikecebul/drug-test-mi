'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { useStore } from '@tanstack/react-form'
import { SCREENING_TYPES } from '@/app/(frontend)/register/types'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { FieldError } from '@/components/ui/field'

export const ScreeningTypeStep = withForm({
  ...getRegisterClientFormOpts('screeningType'),

  render: function Render({ form }) {
    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Screening Type" description="Who is requesting this drug screening?" />

        <form.AppField name="screeningType.requestedBy">
          {(field) => (
            <div className="space-y-3">
              {SCREENING_TYPES.map(
                (option: { value: 'probation' | 'employment' | 'self'; label: string; description: string }) => (
                  <label
                    key={option.value}
                    className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-4 transition-all ${
                      requestedBy === option.value ? 'border-primary bg-primary/10' : 'border-border'
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
                ),
              )}
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.AppField>
      </div>
    )
  },
})
