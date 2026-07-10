"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/utilities/cn"

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressPrimitive.Root.Props
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    className={cn("relative h-4 w-full", className)}
    {...props}
  >
    <ProgressPrimitive.Track className="h-full w-full overflow-hidden rounded-full bg-secondary">
      <ProgressPrimitive.Indicator className="h-full bg-primary transition-all" />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
))
Progress.displayName = "Progress"

export { Progress }
