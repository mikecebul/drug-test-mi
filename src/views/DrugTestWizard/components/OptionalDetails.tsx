'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { focusFirstInvalidField } from '@/lib/form-scroll-focus'

/** Keep controls mounted so their active FormGroup still validates collapsed fields. */
export function OptionalDetails({
  title = 'Edit test details',
  invalid = false,
  children,
}: {
  title?: string
  invalid?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!invalid) return
    const frame = requestAnimationFrame(() => {
      setOpen(true)
      requestAnimationFrame(() => focusFirstInvalidField(content.current))
    })
    return () => cancelAnimationFrame(frame)
  }, [invalid])
  return (
    <Collapsible open={open || invalid} onOpenChange={setOpen} className="border-border rounded-lg border">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-start p-4" />}>
        <ChevronRight data-icon="inline-start" className="transition-transform in-data-[open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsiblePanel keepMounted>
        <div ref={content} className="border-border flex flex-col gap-6 border-t p-4 sm:p-6">
          {children}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
