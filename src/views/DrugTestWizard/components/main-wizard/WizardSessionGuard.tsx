'use client'

import { useAuth } from '@payloadcms/ui'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { Admin } from '@/payload-types'
import { AdminSessionExpiredError, refreshAdminSession } from '@/lib/auth/admin-session'

function getLoginURL() {
  const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/admin/login?redirect=${encodeURIComponent(currentURL)}`
}

export function WizardSessionGuard({ children }: { children: ReactNode }) {
  const { setUser } = useAuth<Admin>()
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null)
  const pendingNextTargetRef = useRef<HTMLElement | null>(null)
  const replayTargetRef = useRef<HTMLElement | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const verifySession = useCallback(
    (notifyOnError: boolean) => {
      if (refreshPromiseRef.current) return refreshPromiseRef.current

      setIsChecking(true)
      const refreshPromise = refreshAdminSession()
        .then((session) => {
          setUser(session)
          return true
        })
        .catch((error: unknown) => {
          if (error instanceof AdminSessionExpiredError) {
            window.location.assign(getLoginURL())
          } else if (notifyOnError) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Unable to verify your session. Check the connection and try again.',
              { id: 'wizard-session-verification' },
            )
          }

          return false
        })
        .finally(() => {
          if (refreshPromiseRef.current === refreshPromise) {
            refreshPromiseRef.current = null
          }
          setIsChecking(false)
        })

      refreshPromiseRef.current = refreshPromise
      return refreshPromise
    },
    [setUser],
  )

  useEffect(() => {
    const verifyAfterResume = () => {
      if (document.visibilityState === 'visible') {
        void verifySession(false)
      }
    }

    document.addEventListener('visibilitychange', verifyAfterResume)
    window.addEventListener('focus', verifyAfterResume)
    window.addEventListener('pageshow', verifyAfterResume)

    return () => {
      document.removeEventListener('visibilitychange', verifyAfterResume)
      window.removeEventListener('focus', verifyAfterResume)
      window.removeEventListener('pageshow', verifyAfterResume)
    }
  }, [verifySession])

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const eventTarget = event.target
    if (!(eventTarget instanceof Element)) return

    const nextButton = eventTarget.closest<HTMLElement>('[data-testid="wizard-next-button"]')
    if (!nextButton || !event.currentTarget.contains(nextButton)) return

    if (replayTargetRef.current === nextButton) {
      replayTargetRef.current = null
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // Queue one forward action while verification is in progress. This also
    // prevents a double click from replaying the workflow action more than once.
    if (pendingNextTargetRef.current) return
    pendingNextTargetRef.current = nextButton

    void verifySession(true)
      .then((isAuthenticated) => {
        if (!isAuthenticated || !nextButton.isConnected || nextButton.matches(':disabled')) return

        replayTargetRef.current = nextButton
        nextButton.click()
      })
      .finally(() => {
        if (pendingNextTargetRef.current === nextButton) {
          pendingNextTargetRef.current = null
        }
      })
  }

  return (
    <div aria-busy={isChecking} onClickCapture={handleClickCapture}>
      {children}
    </div>
  )
}
