'use client'

import { useStore } from '@tanstack/react-form'
import { useFieldContext } from '../hooks/form-context'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'

export interface EmailFieldUIProps {
  label?: string | null
  colSpan?: '1' | '2'
  required?: boolean | null
}

export default function EmailField({ label, colSpan, required }: EmailFieldUIProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0

  return (
    <div className={cn('col-span-2 w-full', { '@lg:col-span-1': colSpan === '1' })}>
      <div className={cn('grid w-full gap-2')}>
        <Label htmlFor={field.name}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
        <Input
          id={field.name}
          name={field.name}
          type="email"
          value={field.state.value ?? ''}
          onBlur={() => field.handleBlur()}
          onChange={(e) => field.handleChange(e.target.value)}
          autoComplete="email"
          aria-invalid={hasErrors || undefined}
        />
      </div>
      <div>
        {errors && errors.length > 0 && (
          <em className="text-destructive text-sm first:mt-1">
            {typeof errors[0] === 'string' ? errors[0] : errors[0]?.message}
          </em>
        )}
      </div>
    </div>
  )
}
