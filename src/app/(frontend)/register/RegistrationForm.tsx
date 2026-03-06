'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterClientWorkflow } from './Workflow'

export const RegistrationForm = (props?: Record<string, unknown>) => {
  void props
  const [isComplete, setIsComplete] = useState(false)

  if (isComplete) {
    const steps = ['Sign in to your account', 'Schedule appointment', 'Complete your screening']

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
              <h2 className="text-card-foreground text-sm font-semibold tracking-[0.12em] uppercase">Account Ready</h2>
              <p className="text-muted-foreground mt-3 text-base">
                Your account has been created successfully. You can sign in now and continue to scheduling.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/schedule">Go to Scheduling</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-card-foreground mb-5 text-sm font-semibold tracking-[0.12em] uppercase">Next Steps</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-full">
                      {index + 1}
                    </div>
                    <span className="text-foreground text-base font-medium">{step}</span>
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
                onComplete={() => {
                  setIsComplete(true)
                }}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
