'use client'

import * as React from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '@/utilities/cn'

const Slider = React.forwardRef<
  HTMLDivElement,
  SliderPrimitive.Root.Props
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative w-full', className)}
    thumbAlignment="edge"
    {...props}
  >
    <SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center">
      <SliderPrimitive.Track className="bg-secondary relative h-2 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Indicator className="bg-primary absolute h-full" />
        <SliderPrimitive.Thumb className="border-primary bg-background ring-offset-background focus-visible:ring-ring block size-5 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-disabled:pointer-events-none data-disabled:opacity-50" />
      </SliderPrimitive.Track>
    </SliderPrimitive.Control>
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'

export { Slider }
