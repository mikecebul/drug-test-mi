'use client'

import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useTheme } from '@payloadcms/ui'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const subscribeToClientMount = () => () => {}

const Toaster = ({ richColors = true, toastOptions, ...props }: ToasterProps) => {
  const { theme } = useTheme()
  const isClientMounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  )
  const sonnerTheme: ToasterProps['theme'] = theme === 'dark' ? 'dark' : 'light'
  const mergedToastOptions: ToasterProps['toastOptions'] = {
    ...toastOptions,
    classNames: {
      toast: '!items-start',
      icon: '!self-start !mt-0.5',
      ...toastOptions?.classNames,
    },
  }

  if (!isClientMounted) return null

  return createPortal(
    <Sonner
      data-twp
      theme={sonnerTheme}
      richColors={richColors}
      position="top-right"
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
    />,
    document.body,
  )
}

export { Toaster }
