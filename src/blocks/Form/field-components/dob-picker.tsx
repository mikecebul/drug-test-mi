'use client'

import { useFieldContext } from '../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'
import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface DobFieldUIProps {
  label?: string | null
  colSpan?: string
  required?: boolean | null
}

function formatDate(date: Date | undefined) {
  if (!date || isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()

  return `${month}/${day}/${year}`
}

/**
 * Expands a 2-digit year to 4 digits for DOB context.
 * Years 00 to current year => 20xx
 * Years after current year to 99 => 19xx
 */
function expandTwoDigitYear(year: number): number {
  const currentYear = new Date().getFullYear()
  const currentTwoDigit = currentYear % 100

  if (year <= currentTwoDigit) {
    return 2000 + year
  } else {
    return 1900 + year
  }
}

/**
 * Parses a date string, expanding 2-digit years appropriately for DOB.
 */
function parseDateWithYearExpansion(value: string): Date {
  const isoDateMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/)
  if (isoDateMatch) {
    const [, yearStr, monthStr, dayStr] = isoDateMatch
    return createLocalDate(parseInt(yearStr, 10), parseInt(monthStr, 10), parseInt(dayStr, 10))
  }

  // Match MM/DD/YY or MM-DD-YY (2-digit year)
  const displayDateMatch = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)

  if (displayDateMatch) {
    const [, monthStr, dayStr, yearStr] = displayDateMatch
    const month = parseInt(monthStr, 10)
    const day = parseInt(dayStr, 10)
    const parsedYear = parseInt(yearStr, 10)
    const year = yearStr.length === 2 ? expandTwoDigitYear(parsedYear) : parsedYear
    return createLocalDate(year, month, day)
  }

  return new Date(Number.NaN)
}

function createLocalDate(year: number, month: number, day: number): Date {
  const date = new Date(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return new Date(Number.NaN)
  }

  return date
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  if (isNaN(date.getTime())) {
    return false
  }
  // Ensure year is in reasonable range for DOB (1900 - current year)
  const year = date.getFullYear()
  const currentYear = new Date().getFullYear()
  return year >= 1900 && year <= currentYear
}

export default function DobPicker({ label, colSpan, required }: DobFieldUIProps) {
  const field = useFieldContext<string | Date | undefined>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0
  const [open, setOpen] = React.useState(false)

  // Handle both string and Date values
  const dateValue = React.useMemo(() => {
    if (!field.state.value) return undefined
    if (field.state.value instanceof Date) return field.state.value
    if (typeof field.state.value === 'string' && field.state.value !== '') {
      const parsed = parseDateWithYearExpansion(field.state.value)
      return isValidDate(parsed) ? parsed : undefined
    }
    return undefined
  }, [field.state.value])

  const [month, setMonth] = React.useState<Date | undefined>(dateValue)
  const inputValue = React.useMemo(() => {
    if (field.state.value instanceof Date) {
      return formatDate(field.state.value)
    }

    if (typeof field.state.value === 'string') {
      if (/^\d{4}-\d{1,2}-\d{1,2}(?:T.*)?$/.test(field.state.value) && dateValue) {
        return formatDate(dateValue)
      }
      return field.state.value
    }

    return ''
  }, [dateValue, field.state.value])

  // Match MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD (exactly 2 or 4 digit years)
  const datePattern = /^(?:\d{1,2}[\/\-]\d{1,2}[\/\-](?:\d{2}|\d{4})|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/

  return (
    <div className={cn('col-span-2 flex w-full flex-col gap-2', { '@lg:col-span-1': colSpan === '1' })}>
      <Field data-invalid={hasErrors}>
        <FieldLabel htmlFor={field.name} className="px-1">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </FieldLabel>
        <div className="relative flex gap-2">
          <Input
            id={field.name}
            name={field.name}
            value={inputValue}
            placeholder="01/01/1900"
            className="pr-10"
            onChange={(e) => {
              const value = e.target.value
              field.handleChange(value || undefined)

              if (datePattern.test(value)) {
                const date = parseDateWithYearExpansion(value)
                if (isValidDate(date)) {
                  setMonth(date)
                }
              }
            }}
            onBlur={(event) => {
              const value = event.currentTarget.value

              // Only parse if input matches valid date pattern
              if (!datePattern.test(value)) {
                field.handleBlur()
                return
              }

              const date = parseDateWithYearExpansion(value)
              if (isValidDate(date)) {
                const formatted = formatDate(date)
                field.handleChange(formatted)
                setMonth(date)
              }
              field.handleBlur()
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
              }
            }}
            aria-invalid={hasErrors || undefined}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={<Button
                id="date-picker"
                variant="ghost"
                size="icon"
                type="button"
                className="absolute top-1/2 right-2 h-6 w-6 -translate-y-1/2"
              />}
            >
              <CalendarIcon className="size-3" />
              <span className="sr-only">Select date</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={-8} sideOffset={10}>
              <Calendar
                mode="single"
                selected={dateValue}
                captionLayout="dropdown"
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  const formatted = formatDate(date)
                  field.handleChange(formatted)
                  field.handleBlur()
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <FieldError errors={errors} />
      </Field>
    </div>
  )
}
