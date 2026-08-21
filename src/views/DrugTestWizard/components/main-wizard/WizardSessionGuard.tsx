'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AdminSessionExpiredError, refreshAdminSession } from '@/lib/auth/admin-session'

function getLoginURL() {
  const currentURL = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/admin/login?redirect=${encodeURIComponent(currentURL)}`
}

type WizardSessionContextValue = {
  isCheckingSession: boolean
  requireActiveSession: () => Promise<boolean>
}

const WizardSessionContext = createContext<WizardSessionContextValue | null>(null)

export function useWizardSession() {
  const context = useContext(WizardSessionContext)
  if (!context) {
    throw new Error('useWizardSession must be used within WizardSessionGuard')
  }
  return context
}

export function WizardSessionGuard({ children }: { children: ReactNode }) {
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const verifySession = useCallback(
    (notifyOnError: boolean) => {
      if (refreshPromiseRef.current) return refreshPromiseRef.current

      setIsChecking(true)
      const refreshPromise = refreshAdminSession()
        .then(() => true)
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
    [],
  )

  const requireActiveSession = useCallback(() => verifySession(true), [verifySession])
  const contextValue = useMemo(
    () => ({ isCheckingSession: isChecking, requireActiveSession }),
    [isChecking, requireActiveSession],
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

  return (
    <WizardSessionContext.Provider value={contextValue}>
      <div aria-busy={isChecking}>{children}</div>
    </WizardSessionContext.Provider>
  )
}
