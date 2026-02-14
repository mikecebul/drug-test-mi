'use client'

import { Suspense, useState } from 'react'
import { ArrowRight, Calendar, Check, CircleCheck, FlaskConical, Mail, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterClientWorkflow } from './Workflow'

export const RegistrationForm = (props?: Record<string, unknown>) => {
  void props
  const [showVerification, setShowVerification] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState<string>('')
  const [isResending, setIsResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResendEmail = async () => {
    if (!verifiedEmail) return
    setIsResending(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setIsResending(false)
    setResent(true)
    toast.success(`Verification email resent to ${verifiedEmail}`)
    setTimeout(() => setResent(false), 2500)
  }

  if (showVerification) {
    const steps = [
      { label: 'Verify email', icon: Mail, done: false, active: true },
      { label: 'Schedule appointment', icon: Calendar, done: false, active: false },
      { label: 'Get tested', icon: FlaskConical, done: false, active: false },
    ]

    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-8 flex justify-center">
              <div className="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full">
                <div className="bg-primary flex h-14 w-14 items-center justify-center rounded-full">
                  <Check className="text-primary-foreground h-7 w-7" strokeWidth={3} />
                </div>
              </div>
            </div>
            <h1 className="text-foreground text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Registration Complete
            </h1>
          </div>

          <Card className="border-primary/30 shadow-primary/10 mb-4 rounded-3xl shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                <div className="bg-accent flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Mail className="text-accent-foreground h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-card-foreground text-sm font-semibold tracking-[0.12em] uppercase">
                    Verification Email Sent
                  </h2>
                  <p className="text-muted-foreground mt-2 text-base">
                    Check your inbox for your secure activation link.
                  </p>
                  <div className="bg-muted mt-4 inline-flex max-w-full items-center gap-2 rounded-xl px-4 py-2.5">
                    <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span className="text-foreground truncate text-base font-medium">{verifiedEmail}</span>
                  </div>
                  <p className="text-muted-foreground mt-4 text-base">
                    Click the verification link to activate your account and schedule your screening.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4 rounded-3xl">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-card-foreground text-lg font-medium">Didn&apos;t receive the email?</p>
                  <p className="text-muted-foreground mt-1 text-base">
                    Check your spam folder, then request a new one.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="h-10 shrink-0 px-4"
                >
                  <RefreshCw className={isResending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  {resent ? 'Sent!' : isResending ? 'Sending...' : 'Resend'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-card-foreground mb-5 text-sm font-semibold tracking-[0.12em] uppercase">
                Next Steps
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {steps.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div
                      className={
                        step.active
                          ? 'bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full'
                          : 'bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full'
                      }
                    >
                      {step.done ? <CircleCheck className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                    </div>
                    <span
                      className={
                        step.active
                          ? 'text-foreground text-base font-medium'
                          : 'text-muted-foreground text-base font-medium'
                      }
                    >
                      {step.label}
                    </span>
                    {index < steps.length - 1 && <ArrowRight className="text-border h-4 w-4 sm:mx-1" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border rounded-2xl border shadow-xl">
          <CardHeader className="pb-6 text-center">
            <CardTitle className="mb-2 text-3xl">Drug Screening Registration</CardTitle>
            <CardDescription className="text-base">Complete your information to request a screening</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <Suspense
              fallback={<div className="text-muted-foreground py-12 text-center">Loading registration form…</div>}
            >
              <RegisterClientWorkflow
                onComplete={(email) => {
                  setVerifiedEmail(email)
                  setShowVerification(true)
                }}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
