'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { useFieldContext } from '../hooks/form-context'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/cn'

export interface DateFieldUIProps {
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

function parseInputDate(value: string): Date | undefined {
  if (!value.trim()) return undefined

  // Try parsing various date formats
  const date = new Date(value)
  return isValidDate(date) ? date : undefined
}

export default function DateField({
  label,
  placeholder,
  description,
  colSpan,
  required,
  disabled,
  minDate,
  maxDate,
}: DateFieldUIProps) {
  const field = useFieldContext<string | Date | undefined>()
  const errors = field.state.meta.errors
  const hasErrors = errors.length > 0
  const [open, setOpen] = React.useState(false)

  // Handle both string and Date values
  const dateValue = React.useMemo(() => {
    if (!field.state.value) return undefined
    if (field.state.value instanceof Date) return field.state.value
    if (typeof field.state.value === 'string' && field.state.value !== '') {
      return parseInputDate(field.state.value)
    }
    return undefined
  }, [field.state.value])

  // Input display value (formatted for input)
  const [inputValue, setInputValue] = React.useState(() => formatDisplayDate(dateValue))

  // Update input value when date changes externally
  React.useEffect(() => {
    setInputValue(formatDisplayDate(dateValue))
  }, [dateValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    const parsedDate = parseInputDate(value)
    if (isValidDate(parsedDate)) {
      field.handleChange(parsedDate)
    } else if (value === '') {
      field.handleChange(undefined)
    }
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    field.handleChange(date)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className={cn('col-span-2 flex w-full flex-col', { '@lg:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name} className="px-1">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>

        <div className="relative flex gap-2">
          <Input
            id={field.name}
            value={inputValue}
            placeholder={placeholder || 'Select date'}
            disabled={disabled}
            onChange={handleInputChange}
            onBlur={field.handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-background pr-10"
            aria-invalid={hasErrors || undefined}
          />

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                disabled={disabled}
                className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                type="button"
              >
                <CalendarIcon className="size-3.5" />
                <span className="sr-only">Open calendar</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
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
        </div>

        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
