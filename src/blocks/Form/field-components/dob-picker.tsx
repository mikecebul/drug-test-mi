'use client'

import { useFieldContext } from '../hooks/form-context'
import { useStore } from '@tanstack/react-form'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { formatDobInput, parseDob } from '@/lib/date-utils'
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

export default function DobPicker({ label, colSpan, required }: DobFieldUIProps) {
  const field = useFieldContext<string | Date | undefined>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = !!errors && errors.length > 0
  const [open, setOpen] = React.useState(false)

  // Handle both string and Date values
  const dateValue = React.useMemo(() => {
    if (!field.state.value) return undefined
    return parseDob(field.state.value) ?? undefined
  }, [field.state.value])

  const [month, setMonth] = React.useState<Date | undefined>(dateValue)
  const inputValue = React.useMemo(() => {
    if (field.state.value instanceof Date) {
      return formatDobInput(field.state.value)
    }

    if (typeof field.state.value === 'string') {
      if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:T.*)?$/.test(field.state.value) && dateValue) {
        return formatDobInput(dateValue)
      }
      return field.state.value
    }

    return ''
  }, [dateValue, field.state.value])

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

              const date = parseDob(value)
              if (date) {
                setMonth(date)
              }
            }}
            onBlur={(event) => {
              const value = event.currentTarget.value
              const date = parseDob(value)
              if (date) {
                field.handleChange(formatDobInput(date))
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
                  const formatted = formatDobInput(date)
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
