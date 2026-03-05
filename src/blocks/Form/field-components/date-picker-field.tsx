'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { useFieldContext } from '../hooks/form-context'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/cn'

export interface DatePickerFieldUIProps {
  label?: string | null
  placeholder?: string
  description?: string
  colSpan?: string
  required?: boolean | null
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
}

function formatDisplayDate(date: Date | undefined): string {
  if (!date) return ''

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function isValidDate(date: Date | undefined): boolean {
  if (!date) return false
  return !isNaN(date.getTime())
}

function parseValue(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'string' && value !== '') {
    const date = new Date(value)
    return isValidDate(date) ? date : undefined
  }
  return undefined
}

export default function DatePickerField({
  label,
  placeholder = 'Select date',
  description,
  colSpan,
  required,
  disabled,
  minDate,
  maxDate,
}: DatePickerFieldUIProps) {
  const field = useFieldContext<string | Date | undefined>()
  const errors = field.state.meta.errors
  const hasErrors = errors.length > 0
  const [open, setOpen] = React.useState(false)

  // Handle both string and Date values
  const dateValue = React.useMemo(() => parseValue(field.state.value), [field.state.value])

  const handleCalendarSelect = (date: Date | undefined) => {
    field.handleChange(date)
    setOpen(false)
  }

  const displayText = dateValue ? formatDisplayDate(dateValue) : placeholder

  return (
    <div className={cn('col-span-2 flex w-full flex-col', { '@lg:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name} className="px-1">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={field.name}
              variant="outline"
              disabled={disabled}
              aria-invalid={hasErrors || undefined}
              className={cn(
                'w-full justify-start text-left font-normal',
                !dateValue && 'text-muted-foreground',
              )}
              type="button"
            >
              <CalendarIcon className="mr-2 size-4" />
              {displayText}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start" sideOffset={10}>
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleCalendarSelect}
              captionLayout="dropdown"
              disabled={(date) => {
                if (disabled) return true
                if (minDate && date < minDate) return true
                if (maxDate && date > maxDate) return true
                return false
              }}
            />
          </PopoverContent>
        </Popover>

        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
