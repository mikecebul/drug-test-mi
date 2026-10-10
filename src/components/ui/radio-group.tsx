'use client'

import * as React from 'react'
import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { Circle } from 'lucide-react'

import { cn } from '@/utilities/cn'

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive className={cn('grid gap-2', className)} {...props} />
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      nativeButton
      render={<button type="button" />}
      className={cn(
        'border-muted-foreground bg-background data-checked:border-primary text-primary ring-offset-background focus-visible:ring-ring aspect-square size-5 rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
