'use client'

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { cn } from '@/utilities/cn'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.Trigger

function CollapsiblePanel({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn(
        "flex h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden",
        className,
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel }
