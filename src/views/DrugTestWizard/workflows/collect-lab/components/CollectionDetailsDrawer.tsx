'use client'

import { useEffect, useRef, useState } from 'react'
import { revalidateLogic } from '@tanstack/react-form'
import { format, isValid, parse } from 'date-fns'
import { CalendarIcon, Clock4, Pencil, X } from 'lucide-react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Calendar } from '@/components/ui/calendar'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  collectionDateFromParts,
  collectionDateParts,
  collectionDetailsSchema,
  LAB_TEST_LABELS,
} from '../collection-details'
import { labTests } from '../validators'

type Details = { testType: (typeof labTests)[number]; collectionDate: string }

export function CollectionDetailsDrawer({
  value,
  open,
  onOpenChange,
  onApply,
  invalidField,
}: {
  value: Details
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: Details) => void
  invalidField?: 'testType' | 'collectionDate'
}) {
  const typeRef = useRef<HTMLButtonElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const form = useAppForm({
    defaultValues: { testType: value.testType, ...collectionDateParts(value.collectionDate) },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: collectionDetailsSchema },
    onSubmitInvalid: ({ formApi }) => {
      if (formApi.state.fieldMeta.testType?.errors.length) typeRef.current?.focus()
      else if (formApi.state.fieldMeta.date?.errors.length) dateRef.current?.focus()
      else timeRef.current?.focus()
    },
    onSubmit: ({ value: draft }) => {
      const collectionDate = collectionDateFromParts(draft.date, draft.time, value.collectionDate)
      if (!collectionDate) return
      onApply({ testType: draft.testType, collectionDate })
      setCalendarOpen(false)
      onOpenChange(false)
    },
  })
  useEffect(() => {
    if (open && !wasOpen.current) form.reset({ testType: value.testType, ...collectionDateParts(value.collectionDate) })
    wasOpen.current = open
  }, [open, value.testType, value.collectionDate, form])

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        setCalendarOpen(false)
        onOpenChange(nextOpen)
      }}
      swipeDirection="right"
    >
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline-primary"
            size="sm"
            id="edit-lab-test-details"
            aria-label="Edit test details"
            aria-invalid={Boolean(invalidField)}
          />
        }
      >
        <Pencil data-icon="inline-start" />
        Edit
      </DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        initialFocus={() => (invalidField === 'collectionDate' ? dateRef.current : typeRef.current)}
        className="staff-interface data-[swipe-axis=x]:w-full data-[swipe-axis=x]:sm:w-[min(90vw,30rem)]"
      >
        <DrawerHeader className="flex-row items-center justify-between gap-3 border-b">
          <DrawerTitle>Edit test details</DrawerTitle>
          <DrawerClose render={<Button type="button" variant="ghost" size="icon" aria-label="Close test details" />}>
            <X />
          </DrawerClose>
        </DrawerHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <form.Field name="testType">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="lab-test-type">Test type</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value && labTests.includes(value as Details['testType']))
                        field.handleChange(value as Details['testType'])
                    }}
                    items={LAB_TEST_LABELS}
                  >
                    <SelectTrigger
                      id="lab-test-type"
                      ref={typeRef}
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {labTests.map((type) => (
                          <SelectItem key={type} value={type}>
                            {LAB_TEST_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="date">
              {(field) => {
                const parsedDate = parse(field.state.value, 'yyyy-MM-dd', new Date())
                const selectedDate = isValid(parsedDate) ? parsedDate : undefined
                return (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor="collection-date">Collection date</FieldLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <InputGroup>
                        <InputGroupInput
                          ref={dateRef}
                          id="collection-date"
                          name={field.name}
                          type="date"
                          className="[&::-webkit-calendar-picker-indicator]:hidden"
                          value={field.state.value}
                          onInput={(event) => field.handleChange(event.currentTarget.value)}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={field.state.meta.errors.length > 0}
                          aria-describedby="collection-date-error"
                        />
                        <InputGroupAddon align="inline-end">
                          <PopoverTrigger
                            render={<InputGroupButton size="icon-sm" aria-label="Choose collection date" />}
                          >
                            <CalendarIcon />
                          </PopoverTrigger>
                        </InputGroupAddon>
                      </InputGroup>
                      <PopoverContent className="staff-interface border-border w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          required
                          autoFocus
                          selected={selectedDate}
                          defaultMonth={selectedDate}
                          onSelect={(date) => {
                            if (date) field.handleChange(format(date, 'yyyy-MM-dd'))
                            field.handleBlur()
                            setCalendarOpen(false)
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <FieldError id="collection-date-error" errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name="time">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="collection-time">Time</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      ref={timeRef}
                      id="collection-time"
                      name={field.name}
                      type="time"
                      className="[&::-webkit-calendar-picker-indicator]:hidden"
                      step="60"
                      value={field.state.value}
                      onInput={(event) => field.handleChange(event.currentTarget.value)}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby="collection-time-error"
                    />
                    <InputGroupAddon align="inline-end">
                      <Clock4 aria-hidden="true" />
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError id="collection-time-error" errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <DrawerFooter className="flex-row justify-end border-t">
            <DrawerClose render={<Button type="button" variant="outline" />}>Cancel</DrawerClose>
            <Button type="submit">Apply changes</Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
