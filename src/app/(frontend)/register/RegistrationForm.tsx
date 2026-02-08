'use client'

import React, { Suspense, useState } from 'react'
import { CheckCircle, RefreshCw, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RegisterClientWorkflow } from './Workflow'

export const RegistrationForm = (props?: any) => {
  const [showVerification, setShowVerification] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState<string>('')

  const handleResendEmail = () => {
    if (!verifiedEmail) return
    toast.success(`Verification email resent to ${verifiedEmail}`)
  }

  if (showVerification) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center w-20 h-20 bg-secondary/20 rounded-full mb-6">
                <CheckCircle className="w-10 h-10 text-secondary" />
              </div>

              <h2 className="text-3xl font-bold text-foreground mb-3">Registration Complete!</h2>
              <p className="text-lg text-muted-foreground mb-8">Please verify your email to continue</p>

              <div className="bg-accent rounded-xl p-6 mb-8 border border-border">
                <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm text-accent-foreground mb-2">We&apos;ve sent a verification email to:</p>
                <p className="text-lg font-semibold text-foreground mb-4">{verifiedEmail}</p>
                <p className="text-sm text-muted-foreground">
                  Please check your inbox and click the verification link to activate your account and schedule your screening.
                </p>
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  Didn&apos;t receive the email? Check your spam folder or
                </p>
                <Button
                  onClick={handleResendEmail}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Next:</strong> Verify your email → Schedule appointment → Get tested
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Drug Screening Registration</h1>
            <p className="text-muted-foreground">Complete your information to request a screening</p>
          </div>

          <Suspense fallback={<div className="text-muted-foreground text-center py-12">Loading registration form…</div>}>
            <RegisterClientWorkflow
              onComplete={(email) => {
                setVerifiedEmail(email)
                setShowVerification(true)
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
