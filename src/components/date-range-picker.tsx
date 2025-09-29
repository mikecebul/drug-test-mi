"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/utilities/cn"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              `${format(value.from, 'LLL dd, y')} - ${format(value.to, 'LLL dd, y')}`
            ) : (
              format(value.from, 'LLL dd, y')
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          captionLayout="dropdown"
          numberOfMonths={1}
          className="block md:hidden"
        />
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          captionLayout="dropdown"
          numberOfMonths={2}
          className="hidden md:block"
        />
      </PopoverContent>
    </Popover>
  )
}
