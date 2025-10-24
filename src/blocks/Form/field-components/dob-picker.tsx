'use client'

import { useFieldContext } from '../hooks/form-context'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/cn'
import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  return !isNaN(date.getTime())
}

export default function DobPicker({ label, colSpan, required }: DobFieldUIProps) {
  const field = useFieldContext<string | Date | undefined>()
  const errors = field.state.meta.errors
  const [open, setOpen] = React.useState(false)

  // Handle both string and Date values
  const dateValue = React.useMemo(() => {
    if (!field.state.value) return undefined
    if (field.state.value instanceof Date) return field.state.value
    if (typeof field.state.value === 'string' && field.state.value !== '') {
      try {
        return new Date(field.state.value)
      } catch {
        return undefined
      }
    }
    return undefined
  }, [field.state.value])

  const [month, setMonth] = React.useState<Date | undefined>(dateValue)
  const [inputValue, setInputValue] = React.useState(formatDate(dateValue))

  // Sync input value when date changes externally
  React.useEffect(() => {
    setInputValue(formatDate(dateValue))
  }, [dateValue])

  return (
    <div className={cn('col-span-2 flex w-full flex-col gap-3', { '@lg:col-span-1': colSpan === '1' })}>
      <Label htmlFor={field.name} className="px-1">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div className="relative flex gap-2">
        <Input
          id={field.name}
          value={inputValue}
          placeholder="01/01/1900"
          className="bg-background pr-10"
          onChange={(e) => {
            const value = e.target.value
            setInputValue(value)

            // Only clear if empty
            if (value === '') {
              field.handleChange(undefined)
            }
          }}
          onBlur={() => {
            // On blur, try to parse and format the date if valid
            const date = new Date(inputValue)
            if (isValidDate(date)) {
              field.handleChange(date)
              setMonth(date)
              setInputValue(formatDate(date))
            } else if (inputValue !== '') {
              // If invalid and not empty, keep the user's input to show error
              field.handleChange(inputValue)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date-picker"
              variant="ghost"
              size="icon"
              type="button"
              className="absolute top-1/2 right-2 h-6 w-6 -translate-y-1/2"
            >
              <CalendarIcon className="size-3" />
              <span className="sr-only">Select date</span>
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
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                field.handleChange(date)
                setInputValue(formatDate(date))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {errors && <em className="text-destructive text-sm first:mt-2">{errors[0]?.message}</em>}
    </div>
  )
}
