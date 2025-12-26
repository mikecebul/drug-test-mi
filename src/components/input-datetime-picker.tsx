'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/cn'

function formatDisplayDateTime(date: Date | undefined) {
  if (!date || isNaN(date.getTime())) {
    return ''
  }

  // Format like: Oct 31, 2025 8:30 PM
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${dateStr} ${timeStr}`
}

interface InputDateTimePickerProps {
  id?: string
  label?: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export default function InputDateTimePicker({
  id = 'datetime',
  label,
  value,
  onChange,
  placeholder = 'Select date and time',
  required = false,
  className,
}: InputDateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [selectedTime, setSelectedTime] = React.useState<string | null>(
    value
      ? `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`
      : null,
  )
  const [inputValue, setInputValue] = React.useState(formatDisplayDateTime(value))

  // Generate time slots in 30-minute increments (5:00 AM to 11:00 PM)
  const timeSlots = React.useMemo(() => {
    return Array.from({ length: 37 }, (_, i) => {
      const totalMinutes = i * 30
      const hour = Math.floor(totalMinutes / 60) + 5 // Start at 5 AM
      const minute = totalMinutes % 60
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    })
  }, [])

  React.useEffect(() => {
    if (value) {
      setSelectedDate(value)
      setSelectedTime(
        `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`,
      )
      setInputValue(formatDisplayDateTime(value))
    }
  }, [value])

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours, minutes, 0, 0)
      onChange(newDate)
      setInputValue(formatDisplayDateTime(newDate))
    }
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    if (selectedDate) {
      const [hours, minutes] = time.split(':').map(Number)
      const newDate = new Date(selectedDate)
      newDate.setHours(hours, minutes, 0, 0)
      onChange(newDate)
      setInputValue(formatDisplayDateTime(newDate))
      setOpen(false) // Close popover when both date and time are selected
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    // Try to parse the manual input
    const parsed = new Date(inputValue)
    if (!isNaN(parsed.getTime())) {
      setSelectedDate(parsed)
      setSelectedTime(
        `${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`,
      )
      onChange(parsed)
      setInputValue(formatDisplayDateTime(parsed))
    } else if (inputValue === '') {
      setSelectedDate(undefined)
      setSelectedTime(null)
      onChange(undefined)
    } else {
      // Revert to previous valid value
      setInputValue(formatDisplayDateTime(value))
    }
  }

  const formatTimeLabel = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours < 12 ? 'AM' : 'PM'
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <Label htmlFor={id} className="px-1 text-base">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          id={id}
          value={inputValue}
          placeholder={placeholder}
          className="bg-background pr-10 text-base"
          onChange={handleInputChange}
          onBlur={handleInputBlur}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            >
              <CalendarIcon className="size-4" />
              <span className="sr-only">Select date and time</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" sideOffset={10}>
            <Card className="gap-0 border-0 p-0 shadow-none">
              <CardContent className="relative p-0 md:pr-48">
                <div className="p-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    defaultMonth={selectedDate}
                    showOutsideDays={false}
                    className="bg-transparent p-0"
                  />
                </div>
                <div className="no-scrollbar inset-y-0 right-0 flex max-h-72 w-full scroll-pb-6 flex-col gap-2 overflow-y-auto border-t p-3 md:absolute md:max-h-none md:w-48 md:border-t-0 md:border-l">
                  <div className="grid gap-1">
                    {timeSlots.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={selectedTime === time ? 'default' : 'outline'}
                        onClick={() => handleTimeSelect(time)}
                        size="sm"
                        className="w-full justify-start font-normal shadow-none"
                      >
                        {formatTimeLabel(time)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
