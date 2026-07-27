'use client'

import { CalendarClock, CalendarX, Ellipsis, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ScheduleRowActionsProps = {
  attendeeName: string
  cancelHref: string | null
  rescheduleHref: string | null
}

export function ScheduleRowActions({ attendeeName, cancelHref, rescheduleHref }: ScheduleRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mt-2 -mr-2"
            aria-label={`${attendeeName} appointment options`}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {rescheduleHref ? (
            <DropdownMenuItem render={<a href={rescheduleHref} target="_blank" rel="noopener noreferrer" />}>
              <CalendarClock />
              Reschedule
              <ExternalLink className="ml-auto" />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <CalendarClock />
              Reschedule
            </DropdownMenuItem>
          )}
          {cancelHref ? (
            <DropdownMenuItem
              variant="destructive"
              render={<a href={cancelHref} target="_blank" rel="noopener noreferrer" />}
            >
              <CalendarX />
              Cancel
              <ExternalLink className="ml-auto" />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" disabled>
              <CalendarX />
              Cancel
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
