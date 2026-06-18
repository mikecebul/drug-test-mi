'use client'

import { getCalApi } from '@calcom/embed-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import type { CalBookingConfig } from '@/utilities/calcom-config'

interface CalPopupButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  calUsername?: string
  config?: CalBookingConfig
  onModalOpen?: () => void
}

export function CalPopupButton({
  calUsername = 'midrugtest',
  config = {},
  children,
  className,
  variant = 'default',
  onModalOpen,
  ...props
}: CalPopupButtonProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async function () {
      try {
        // IMPORTANT: namespace is required to properly initialize the iframe
        // Without it, iframe name is malformed and causes race condition errors
        // See: https://github.com/calcom/cal.com/issues/15357
        const cal = await getCalApi({ namespace: 'booking-modal' })

        // Configure UI theme
        cal('ui', {
          theme: 'light',
          ...config,
        })

        if (mounted) {
          setIsReady(true)
        }
      } catch (err) {
        console.error('Failed to initialize Cal.com booking widget:', err)
        if (mounted) {
          setError('Unable to load booking calendar')
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [config])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isReady) return

    setError(null)

    try {
      const cal = await getCalApi({ namespace: 'booking-modal' })

      cal('modal', {
        calLink: calUsername,
        config,
      })

      // Call callback after opening modal (e.g., to close sidebar)
      try {
        onModalOpen?.()
      } catch (callbackErr) {
        console.error('Error in onModalOpen callback:', callbackErr)
      }
    } catch (err) {
      console.error('Failed to open Cal.com booking modal:', err)
      setError('Unable to open booking calendar. Please try again.')
    }
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Button {...props} onClick={handleClick} className={className} variant={variant} disabled>
          {children || (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Appointment
            </>
          )}
        </Button>
        <p className="text-destructive text-xs">{error}</p>
      </div>
    )
  }

  return (
    <Button {...props} onClick={handleClick} className={className} variant={variant} disabled={!isReady}>
      {children || (
        <>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Appointment
        </>
      )}
    </Button>
  )
}
