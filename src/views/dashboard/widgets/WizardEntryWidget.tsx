import Link from 'next/link'
import type { WidgetServerProps } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/utilities/cn'

export default function WizardEntryWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  return (
    <ShadcnWrapper className="pb-0">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Drug Test Wizard</CardTitle>
          <CardDescription className="text-base">
            Start the admin workflow for registration, instant tests, and lab processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/admin/drug-test-upload"
            className={cn(buttonVariants({ size: 'xl' }), 'w-full justify-center md:w-auto')}
          >
            Open Drug Test Wizard
          </Link>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
