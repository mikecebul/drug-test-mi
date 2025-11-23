'use client'

import { getCalApi } from '@calcom/embed-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'

interface CalPopupButtonProps {
  calUsername?: string
  config?: Record<string, any>
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  onModalOpen?: () => void
}

export function CalPopupButton({
  calUsername = 'midrugtest',
  config = {},
  children,
  className,
  variant = 'default',
  onModalOpen,
}: CalPopupButtonProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async function () {
      try {
        const cal = await getCalApi()
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
      const cal = await getCalApi()
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
        <Button onClick={handleClick} className={className} variant={variant} disabled>
          {children || (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Appointment
            </>
          )}
        </Button>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <Button onClick={handleClick} className={className} variant={variant} disabled={!isReady}>
      {children || (
        <>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Appointment
        </>
      )}
    </Button>
  )
}
