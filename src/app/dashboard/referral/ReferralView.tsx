'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowUpRight, MailPlus, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Client } from '@/payload-types'
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_HREF,
  getReferralContacts,
  getReferralDoc,
  getReferralName,
  getReferralTypeLabel,
  getSelfAdditionalRecipients,
} from '../_lib/client-profile'

interface ReferralViewProps {
  user: Client
}

function ReferralRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:px-6">
      <div className="text-muted-foreground text-sm font-medium">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function ReferralView({ user }: ReferralViewProps) {
  const referralDoc = getReferralDoc(user)
  const referralContacts = useMemo(() => getReferralContacts(referralDoc), [referralDoc])
  const selfAdditionalRecipients = useMemo(() => getSelfAdditionalRecipients(user), [user])

  const requestReferralUpdate = () => {
    const clientName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    const clientEmail = user?.email || ''
    const recipientsList = referralContacts.map((row) => row.email).join(', ') || 'Not provided'
    const referralName = getReferralName(referralDoc)
    const referralTypeLabel = getReferralTypeLabel(user?.referralType || '')
    const subject = encodeURIComponent(`Referral Information Update Request - ${clientName}`)
    const body = encodeURIComponent(`Dear MI Drug Test Team,

I would like to request an update to my referral information in my profile.

Client Information:
- Name: ${clientName}
- Email: ${clientEmail}

Current Referral Information:
- Referral Type: ${referralTypeLabel}
- Referral Name: ${referralName}
- Recipients: ${recipientsList}

Please contact me to update this information.

Thank you,
${clientName}`)

    window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_blank')
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">Referral</h1>
          <p className="text-muted-foreground">
            Referral recipients and source details are managed by staff so reporting stays accurate.
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Card className="max-w-4xl">
          <CardHeader className="gap-2 border-b">
            <CardTitle className="text-xl">Referral details</CardTitle>
            <CardDescription>Review where your testing information is routed and request changes when needed.</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y">
              <ReferralRow label="Referral type">
                <p className="text-sm font-medium">{getReferralTypeLabel(user?.referralType || '')}</p>
              </ReferralRow>

              <ReferralRow label="Organization">
                <p className="text-sm font-medium">{getReferralName(referralDoc)}</p>
              </ReferralRow>

              <ReferralRow label="Primary recipients">
                {referralContacts.length > 0 ? (
                  <div className="space-y-2">
                    {referralContacts.map((recipient, index) => (
                      <p key={`${recipient.email}-${index}`} className="text-sm font-medium break-all">
                        {recipient.name || 'Recipient'}
                        <span className="text-muted-foreground ml-2 font-normal">({recipient.email})</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No external referral recipients are stored for this profile.</p>
                )}
              </ReferralRow>

              {user?.referralType === 'self' ? (
                <ReferralRow label="Additional recipients">
                  {selfAdditionalRecipients.length > 0 ? (
                    <div className="space-y-2">
                      {selfAdditionalRecipients.map((recipient, index) => (
                        <p key={`${recipient.email}-${index}`} className="text-sm font-medium break-all">
                          {recipient.name || 'Recipient'}
                          <span className="text-muted-foreground ml-2 font-normal">({recipient.email})</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No additional recipients are currently configured.</p>
                  )}
                </ReferralRow>
              ) : null}
            </div>

            <div className="bg-muted/30 border-t px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Need a referral change?</p>
                  <p className="text-muted-foreground text-sm">
                    Referral updates are reviewed by staff before anything changes in reporting or Redwood.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" asChild variant="outline">
                    <a href={`tel:${SUPPORT_PHONE_HREF}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call {SUPPORT_PHONE_DISPLAY}
                    </a>
                  </Button>
                  <Button type="button" variant="outline" onClick={requestReferralUpdate}>
                    <MailPlus className="mr-2 h-4 w-4" />
                    Request update
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/dashboard/profile">
                      Back to profile
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
