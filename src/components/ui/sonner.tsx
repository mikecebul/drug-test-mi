'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ richColors = true, toastOptions, ...props }: ToasterProps) => {
  const { forcedTheme, resolvedTheme, theme } = useTheme()
  const sonnerTheme = (forcedTheme ?? resolvedTheme ?? theme ?? 'light') as ToasterProps['theme']
  const mergedToastOptions: ToasterProps['toastOptions'] = {
    ...toastOptions,
    classNames: {
      toast: '!items-start',
      icon: '!self-start !mt-0.5',
      ...toastOptions?.classNames,
    },
  }

  return (
    <Sonner
      theme={sonnerTheme}
      richColors={richColors}
      toastOptions={mergedToastOptions}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
