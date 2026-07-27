'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useFieldContext } from '../../hooks/form-context'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/cn'
import { useStore } from '@tanstack/react-form'

interface MedicationDateFieldProps {
  label: string
  isLocked?: boolean
  required?: boolean
}

function parseDateOnly(value: string | undefined): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))

  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return undefined
  }

  return date
}

export default function MedicationDateField({ label, isLocked = false, required = false }: MedicationDateFieldProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)
  const hasErrors = errors.length > 0
  const fieldId = field.name
  const selectedDate = React.useMemo(() => parseDateOnly(field.state.value), [field.state.value])
  const [open, setOpen] = React.useState(false)

  const handleSelect = (date: Date | undefined) => {
    field.handleChange(date ? format(date, 'yyyy-MM-dd') : '')
    field.handleBlur()
    setOpen(false)
  }

  return (
    <Field data-invalid={hasErrors || undefined} data-disabled={isLocked || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={fieldId}
                name={field.name}
                type="button"
                variant="outline"
                disabled={isLocked}
                aria-invalid={hasErrors || undefined}
                data-empty={!selectedDate || undefined}
                className={cn(
                  'data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal',
                  isLocked && 'cursor-not-allowed opacity-50',
                )}
              />
            }
          >
            <CalendarIcon className="size-4" />
            {selectedDate ? format(selectedDate, 'MMM d, yyyy') : <span>Select date</span>}
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start" sideOffset={8}>
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={handleSelect}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}
