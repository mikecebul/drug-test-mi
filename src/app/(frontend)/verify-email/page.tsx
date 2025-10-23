'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ResendVerificationForm } from './ResendVerificationForm'

type VerificationState = 'loading' | 'success' | 'error' | 'invalid' | 'resend'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const shouldResend = searchParams.get('resend') === 'true'
  const [state, setState] = useState<VerificationState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // If resend parameter is present, show resend form directly
    if (shouldResend && !token) {
      setState('resend')
      return
    }

    const verifyEmail = async () => {
      if (!token) {
        setState('invalid')
        return
      }

      try {
        // Payload's email verification endpoint as per docs
        const response = await fetch(`/api/clients/verify/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('Verification response status:', response.status)

        if (response.ok) {
          // 200 status means verification was successful
          setState('success')
        } else {
          const result = await response.json().catch(() => ({}))
          setState('error')
          setErrorMessage(result.errors?.[0]?.message || result.message || 'Verification failed')
        }
      } catch (error) {
        console.error('Verification error:', error)
        setState('error')
        setErrorMessage('Network error occurred')
      }
    }

    verifyEmail()
  }, [token, shouldResend])

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
            <h1 className="text-foreground mb-2 text-2xl font-bold">Verifying your email...</h1>
            <p className="text-muted-foreground">Please wait while we verify your account.</p>
          </div>
        )

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h1 className="text-foreground mb-2 text-2xl font-bold">
              Email Verified Successfully!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your account has been verified. You can now sign in and schedule your drug screening
              appointment.
            </p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">Sign In to Your Account</Link>
              </Button>
            </div>
          </div>
        )

      case 'invalid':
        return (
          <div className="text-center">
            <XCircle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h1 className="text-foreground mb-2 text-2xl font-bold">Invalid Verification Link</h1>
            <p className="text-muted-foreground mb-6">
              The verification link is missing or invalid. Please check your email for the correct
              link.
            </p>
            <div className="space-y-3">
              <Button onClick={() => setState('resend')} className="w-full">
                Resend Verification Email
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/register">Back to Registration</Link>
              </Button>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h1 className="text-foreground mb-2 text-2xl font-bold">Verification Failed</h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage ||
                "We couldn't verify your email. The link may have expired or already been used."}
            </p>
            <div className="space-y-3">
              <Button onClick={() => setState('resend')} className="w-full">
                Resend Verification Email
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/register">Try Registration Again</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/sign-in">Already have an account? Sign In</Link>
              </Button>
            </div>
          </div>
        )

      case 'resend':
        return <ResendVerificationForm showLoginMessage={shouldResend} />
    }
  }

  return (
    <div className="bg-background min-h-screen px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="bg-card border-border rounded-2xl border p-8 shadow-xl">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background min-h-screen px-4 py-12">
          <div className="mx-auto max-w-md">
            <div className="bg-card border-border rounded-2xl border p-8 shadow-xl">
              <div className="text-center">
                <Loader2 className="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
                <h1 className="text-foreground mb-2 text-2xl font-bold">Loading...</h1>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
