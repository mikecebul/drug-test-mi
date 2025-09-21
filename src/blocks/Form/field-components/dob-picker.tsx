'use client'

import { useFieldContext } from '../hooks/form-context'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/utilities/cn'
import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'

export interface DobFieldUIProps {
  label?: string | null
  colSpan?: string
  required?: boolean | null
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

  return (
    <div className={cn('col-span-2 flex w-full flex-col', { '@lg:col-span-1': colSpan === '1' })}>
      <Label htmlFor={field.name} className="px-1 pb-2">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={field.name}
            className="w-full justify-between font-normal"
            type="button"
          >
            {dateValue ? format(dateValue, 'MMMM d, yyyy') : 'Select date'}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            captionLayout="dropdown"
            onSelect={(date: Date | undefined) => {
              // Store Date object directly, convert to ISO on form submission
              field.handleChange(date)
              setOpen(false)
            }}
            required={!!required}
            id={field.name}
          />
        </PopoverContent>
      </Popover>
      {errors && <em className="text-destructive text-sm first:mt-2">{errors[0]?.message}</em>}
    </div>
  )
}
