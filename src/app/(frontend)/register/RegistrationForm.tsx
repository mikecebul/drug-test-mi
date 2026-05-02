'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterClientWorkflow } from './Workflow'

export const RegistrationForm = (props?: Record<string, unknown>) => {
  void props

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
              <RegisterClientWorkflow />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
