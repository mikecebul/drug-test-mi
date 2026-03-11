'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { ArrowUpRight, Lock, Mail, Phone, UserPen } from 'lucide-react'

import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateOnly } from '@/lib/date-utils'
import type { Client } from '@/payload-types'
import {
  formatPhoneDisplay,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_HREF,
  getReferralTypeLabel,
} from '../_lib/client-profile'
import { useProfileFormOpts } from './use-profile-form-opts'

interface ProfileViewProps {
  user: Client
}

function ProfileRow({
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

function ReadOnlyValue({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return <p className={className ?? 'text-sm font-medium'}>{value}</p>
}

export function ProfileView({ user }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const form = useAppForm({
    ...useProfileFormOpts({
      user,
      onSuccess: () => {
        setIsEditing(false)
      },
    }),
  })

  const emailValue = useStore(form.store, (state) => state.values.email)
  const showEmailConfirmation = isEditing && emailValue && emailValue !== user?.email

  const requestIdentityUpdate = () => {
    const clientName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    const subject = encodeURIComponent(`Protected Profile Change Request - ${clientName}`)
    const body = encodeURIComponent(`Dear MI Drug Test Team,

I need help updating protected identity details on my profile.

Client Information:
- Name: ${clientName}
- Email: ${user?.email || 'Not provided'}

Requested change:
- Please contact me to update my legal identity details or referral information.

Thank you,
${clientName}`)

    window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_blank')
  }

  const handleCancel = () => {
    form.reset()
    setIsEditing(false)
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Update the contact details you manage yourself. Identity and referral changes stay reviewed by staff.
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <div className="max-w-4xl space-y-4">
          <Card>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              event.stopPropagation()
              await form.handleSubmit()
            }}
          >
            <CardHeader className="gap-4 border-b">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Personal details</CardTitle>
                  <CardDescription>
                    Manage your contact details here. Protected identity changes stay staff-reviewed.
                  </CardDescription>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2 self-start">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                      {([canSubmit, isSubmitting]) => (
                        <Button type="submit" disabled={!canSubmit || isSubmitting}>
                          {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </form.Subscribe>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="self-start">
                    <UserPen className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y">
                <ProfileRow label="Legal name">
                  <ReadOnlyValue value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not provided'} />
                </ProfileRow>

                <ProfileRow label="Date of birth">
                  <ReadOnlyValue value={user?.dob ? formatDateOnly(user.dob) : 'Not provided'} />
                </ProfileRow>

                <ProfileRow label="Gender">
                  <ReadOnlyValue value={user?.gender?.replace('-', ' ') || 'Not specified'} className="text-sm font-medium capitalize" />
                </ProfileRow>

                <ProfileRow label="Email">
                  {isEditing ? (
                    <form.Field
                      name="email"
                      validators={{
                        onChange: z.string().email('Invalid email address').min(1, 'Email is required'),
                      }}
                    >
                      {(field) => (
                        <div className="max-w-md space-y-2">
                          <Label htmlFor={field.name} className="sr-only">
                            Email address
                          </Label>
                          <Input
                            id={field.name}
                            type="email"
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                            autoComplete="email"
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                  ) : (
                    <ReadOnlyValue value={user?.email || 'Not provided'} className="text-sm font-medium break-all" />
                  )}
                </ProfileRow>

                {showEmailConfirmation ? (
                  <ProfileRow label="Confirm new email">
                    <form.Field
                      name="confirmEmail"
                      validators={{
                        onChangeListenTo: ['email'],
                        onChange: ({ value, fieldApi }) => {
                          const email = fieldApi.form.getFieldValue('email')
                          if (email && value !== email) {
                            return { message: 'Emails do not match' }
                          }

                          return undefined
                        },
                      }}
                    >
                      {(field) => (
                        <div className="max-w-md space-y-2">
                          <Label htmlFor={field.name} className="sr-only">
                            Confirm new email
                          </Label>
                          <Input
                            id={field.name}
                            type="email"
                            value={field.state.value ?? ''}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                            autoComplete="email"
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                  </ProfileRow>
                ) : null}

                <ProfileRow label="Phone">
                  {isEditing ? (
                    <form.Field
                      name="phone"
                      validators={{
                        onChange: z
                          .string()
                          .optional()
                          .refine(
                            (value) =>
                              !value || /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(value),
                            {
                              message: 'Invalid phone number',
                            },
                          ),
                      }}
                    >
                      {(field) => (
                        <div className="max-w-md space-y-2">
                          <Label htmlFor={field.name} className="sr-only">
                            Phone number
                          </Label>
                          <Input
                            id={field.name}
                            type="tel"
                            value={field.state.value ?? ''}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                            autoComplete="tel"
                            placeholder="(231) 373-6341"
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                  ) : (
                    <ReadOnlyValue value={formatPhoneDisplay(user?.phone)} />
                  )}
                </ProfileRow>

                <ProfileRow label="Preferred contact">
                  {isEditing ? (
                    <form.Field
                      name="preferredContactMethod"
                      validators={{
                        onChange: z.enum(['email', 'phone', 'sms']),
                      }}
                    >
                      {(field) => (
                        <div className="max-w-xs space-y-2">
                          <Label htmlFor={field.name} className="sr-only">
                            Preferred contact method
                          </Label>
                          <Select value={field.state.value} onValueChange={field.handleChange}>
                            <SelectTrigger id={field.name} className="w-full">
                              <SelectValue placeholder="Select contact method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="sms">Text / SMS</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </form.Field>
                  ) : (
                    <ReadOnlyValue
                      value={
                        user?.preferredContactMethod === 'sms'
                          ? 'Text / SMS'
                          : user?.preferredContactMethod === 'phone'
                            ? 'Phone'
                            : 'Email'
                      }
                    />
                  )}
                </ProfileRow>

                <ProfileRow label="Referral">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{getReferralTypeLabel(user?.referralType || '')} client</p>
                      <p className="text-muted-foreground text-sm">Recipients and routing live on the referral page.</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/referral">
                        View referral
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </ProfileRow>

                <ProfileRow label="Medications">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                      Medication updates stay in their own workspace.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/medications">
                        Open medications
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </ProfileRow>

                <ProfileRow label="Scheduling">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                      Appointment reminders use the contact details above.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/schedule">
                        Open schedule
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </ProfileRow>
              </div>

              <div className="bg-muted/30 border-t px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Protected identity details</p>
                      <p className="text-muted-foreground text-sm">
                        Name, date of birth, gender, and referral records stay locked so testing identity remains reliable.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" asChild variant="outline">
                      <a href={`tel:${SUPPORT_PHONE_HREF}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                      </a>
                    </Button>
                    <Button type="button" variant="outline" onClick={requestIdentityUpdate}>
                      <Mail className="mr-2 h-4 w-4" />
                      Request change
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
