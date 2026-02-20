"use client"

import { useState } from "react"
import { formatDateOnly } from "@/lib/date-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Edit,
  Eye,
  MailPlus,
} from "lucide-react"
import { useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useProfileFormOpts } from './use-profile-form-opts'
import type { Client } from '@/payload-types'

interface ProfileViewProps {
  user: Client
}

export function ProfileView({ user }: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState("view")

  const formOpts = useProfileFormOpts({
    user,
  })

  const form = useAppForm({
    ...formOpts,
  })

  // Watch email field to show/hide confirmation field
  const emailValue = useStore(form.store, (state) => state.values.email)
  const showEmailConfirmation = emailValue && emailValue !== user?.email

  const getReferralTypeLabel = (type: string) => {
    switch (type) {
      case "court":
        return "Court"
      case "employer":
        return "Employer"
      case "self":
        return "Self"
      default:
        return type
    }
  }

  const getReferralContacts = (referralDoc: any): Array<{ name: string; email: string }> => {
    const map = new Map<string, { name: string; email: string }>()
    const add = (contact: { name?: string; email?: string }) => {
      const email = typeof contact.email === 'string' ? contact.email.trim() : ''
      if (!email) return
      const key = email.toLowerCase()
      const name = typeof contact.name === 'string' ? contact.name.trim() : ''
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { name, email })
        return
      }
      if (!existing.name && name) {
        map.set(key, { name, email: existing.email })
      }
    }

    for (const contact of referralDoc?.contacts || []) {
      add(contact || {})
    }

    // Legacy fallback
    add({ name: referralDoc?.mainContactName, email: referralDoc?.mainContactEmail })
    for (const row of referralDoc?.recipientEmails || []) {
      add({ email: row?.email })
    }

    return Array.from(map.values())
  }

  const requestReferralUpdate = (type: 'court' | 'employer') => {
    const clientName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    const clientEmail = user?.email || ''
    const referralDoc =
      user?.referral && typeof user.referral === 'object' && 'value' in user.referral
        ? user.referral.value
        : user?.referral

    let subject = ''
    let body = ''

    if (type === 'court') {
      subject = encodeURIComponent(`Referral Information Update Request - ${clientName}`)

      const recipientsList = getReferralContacts(referralDoc).map((row) => row.email).join(', ') || 'Not provided'

      body = encodeURIComponent(`Dear MI Drug Test Team,

I would like to request an update to my court/probation referral information in my profile.

Client Information:
- Name: ${clientName}
- Email: ${clientEmail}

Current Court Information:
- Court Name: ${(referralDoc as any)?.name || 'Not provided'}
- Recipients: ${recipientsList}

Please contact me to update this information.

Thank you,
${clientName}`)
    } else if (type === 'employer') {
      subject = encodeURIComponent(`Referral Information Update Request - ${clientName}`)

      const recipientsList = getReferralContacts(referralDoc).map((row) => row.email).join(', ') || 'Not provided'

      body = encodeURIComponent(`Dear MI Drug Test Team,

I would like to request an update to my employment referral information in my profile.

Client Information:
- Name: ${clientName}
- Email: ${clientEmail}

Current Employment Information:
- Employer: ${(referralDoc as any)?.name || 'Not provided'}
- Recipients: ${recipientsList}

Please contact me to update this information.

Thank you,
${clientName}`)
    }

    const mailtoLink = `mailto:mike@midrugtest.com?subject=${subject}&body=${body}`
    window.open(mailtoLink, '_blank')
  }

  // Profile Overview Component (shared between view and edit)
  const ProfileOverview = () => (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="w-5 h-5 mr-2" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-3">
            <span className="text-white text-2xl font-bold">
              {user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}
            </span>
          </div>
          <h3 className="font-semibold text-lg">
            {user?.firstName} {user?.lastName}
          </h3>
          <Badge variant="outline" className="mt-1">
            {getReferralTypeLabel(user?.referralType || '')}
          </Badge>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a
                href={`tel:${user.phone.replace(/\D/g, '')}`}
                onClick={(e) => e.preventDefault()}
                className="pointer-events-none select-text cursor-text"
              >
                {user.phone}
              </a>
            </div>
          )}
          {user?.dob && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{formatDateOnly(user?.dob)}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className={user?.isActive ? "text-green-600" : "text-red-600"}>
              {user?.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Client Type Specific Info Component
  const ClientTypeInfo = () => (
    <>
      {user?.referralType === 'court' && user?.referral && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Court/Probation Information</CardTitle>
                <CardDescription>
                  Your referral source information
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestReferralUpdate('court')}
                className="flex items-center gap-2"
              >
                <MailPlus className="w-4 h-4" />
                Request Update
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Court Name</p>
                <p className="text-muted-foreground">
                  {(user.referral && typeof user.referral === 'object' && 'value' in user.referral && typeof user.referral.value === 'object')
                    ? user.referral.value?.name
                    : 'Not provided'}
                </p>
              </div>

              {(user.referral &&
                typeof user.referral === 'object' &&
                'value' in user.referral &&
                typeof user.referral.value === 'object' &&
                getReferralContacts(user.referral.value).length > 0) && (
                <div>
                  <p className="font-medium mb-2">Results sent to:</p>
                  <ul className="text-muted-foreground space-y-1">
                    {getReferralContacts(user.referral.value).map((recipient, idx) => (
                      <li key={idx} className="pl-4">
                        • {recipient.name || 'Recipient'} <span className="text-xs">({recipient.email})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.referralType === 'employer' && user?.referral && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Employment Information</CardTitle>
                <CardDescription>
                  Your employer contact information
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestReferralUpdate('employer')}
                className="flex items-center gap-2"
              >
                <MailPlus className="w-4 h-4" />
                Request Update
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Employer</p>
                <p className="text-muted-foreground">
                  {(user.referral && typeof user.referral === 'object' && 'value' in user.referral && typeof user.referral.value === 'object')
                    ? user.referral.value?.name
                    : 'Not provided'}
                </p>
              </div>

              {(user.referral &&
                typeof user.referral === 'object' &&
                'value' in user.referral &&
                typeof user.referral.value === 'object' &&
                getReferralContacts(user.referral.value).length > 0) && (
                <div>
                  <p className="font-medium mb-2">Results sent to:</p>
                  <ul className="text-muted-foreground space-y-1">
                    {getReferralContacts(user.referral.value).map((recipient, idx) => (
                      <li key={idx} className="pl-4">
                        • {recipient.name || 'Recipient'} <span className="text-xs">({recipient.email})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.referralType === 'self' && user?.selfReferral?.recipients && user.selfReferral.recipients.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Additional Recipients</CardTitle>
            <CardDescription>
              Additional people who will receive copies of your test results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-2">Results also sent to:</p>
                <ul className="text-muted-foreground space-y-1">
                  {user.selfReferral.recipients.map((recipient, idx) => (
                    <li key={idx} className="pl-4">
                      • {recipient.name} <span className="text-xs">({recipient.email})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">
              Manage your personal information and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="view" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View Profile
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Edit Profile
            </TabsTrigger>
          </TabsList>

          {/* View Mode */}
          <TabsContent value="view" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <ProfileOverview />

              {/* Personal Information - View Mode */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Your basic personal details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium">First Name</p>
                      <p className="text-sm text-muted-foreground mt-1">{user?.firstName || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Name</p>
                      <p className="text-sm text-muted-foreground mt-1">{user?.lastName || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground mt-1">{user?.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {user?.phone ? (
                          <a
                            href={`tel:${user.phone.replace(/\D/g, '')}`}
                            onClick={(e) => e.preventDefault()}
                            className="pointer-events-none select-text cursor-text"
                          >
                            {user.phone}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Date of Birth</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {user?.dob ? formatDateOnly(user.dob) : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Gender</p>
                      <p className="text-sm text-muted-foreground mt-1 capitalize">
                        {user?.gender?.replace('-', ' ') || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Preferences - View Mode */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Contact Preferences</CardTitle>
                <CardDescription>
                  How you prefer to be contacted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-sm font-medium">Preferred Contact Method</p>
                  <p className="text-sm text-muted-foreground mt-1 capitalize">
                    {user?.preferredContactMethod?.replace('sms', 'Text/SMS') || 'Email'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <ClientTypeInfo />
          </TabsContent>

          {/* Edit Mode */}
          <TabsContent value="edit" className="mt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
            >
              <div className="grid lg:grid-cols-3 gap-6">
                <ProfileOverview />

                {/* Personal Information - Edit Mode */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Edit your basic personal details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <form.AppField
                        name="firstName"
                        validators={{
                          onChange: z.string().min(1, 'First name is required'),
                        }}
                      >
                        {(formField) => (
                          <formField.TextField
                            label="First Name"
                            required
                          />
                        )}
                      </form.AppField>

                      <form.AppField
                        name="lastName"
                        validators={{
                          onChange: z.string().min(1, 'Last name is required'),
                        }}
                      >
                        {(formField) => (
                          <formField.TextField
                            label="Last Name"
                            required
                          />
                        )}
                      </form.AppField>

                      <form.AppField
                        name="email"
                        validators={{
                          onChange: z
                            .string()
                            .email('Invalid email address')
                            .min(1, 'Email is required'),
                        }}
                      >
                        {(formField) => (
                          <formField.EmailField
                            label="Email Address"
                            required
                          />
                        )}
                      </form.AppField>

                      {showEmailConfirmation && (
                        <form.AppField
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
                          {(formField) => (
                            <formField.EmailField
                              label="Confirm Email"
                              required
                            />
                          )}
                        </form.AppField>
                      )}

                      <form.AppField
                        name="phone"
                        validators={{
                          onChange: z
                            .string()
                            .optional()
                            .refine((val) => !val || /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(val), {
                              message: 'Invalid phone number'
                            }),
                        }}
                      >
                        {(formField) => (
                          <formField.PhoneField
                            label="Phone Number"
                          />
                        )}
                      </form.AppField>

                      <form.AppField
                        name="dob"
                        validators={{
                          onChange: z.string().optional(),
                        }}
                      >
                        {(formField) => (
                          <formField.DateField
                            label="Date of Birth"
                          />
                        )}
                      </form.AppField>

                      <form.AppField
                        name="gender"
                        validators={{
                          onChange: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
                        }}
                      >
                        {(formField) => (
                          <formField.SelectField
                            label="Gender"
                            options={[
                              { label: 'Male', value: 'male' },
                              { label: 'Female', value: 'female' },
                              { label: 'Other', value: 'other' },
                              { label: 'Prefer not to say', value: 'prefer-not-to-say' },
                            ]}
                          />
                        )}
                      </form.AppField>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Preferences - Edit Mode */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Contact Preferences</CardTitle>
                  <CardDescription>
                    How you prefer to be contacted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form.AppField
                    name="preferredContactMethod"
                    validators={{
                      onChange: z.enum(['email', 'phone', 'sms']),
                    }}
                  >
                    {(formField) => (
                      <formField.SelectField
                        label="Preferred Contact Method"
                        options={[
                          { label: 'Email', value: 'email' },
                          { label: 'Phone', value: 'phone' },
                          { label: 'Text/SMS', value: 'sms' },
                        ]}
                      />
                    )}
                  </form.AppField>
                </CardContent>
              </Card>

              <ClientTypeInfo />

              {/* Submit Button - Positioned closer to form */}
              <div className="mt-6 flex justify-end">
                <form.AppForm>
                  <form.SubmitButton label="Save Changes" />
                </form.AppForm>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        {/* Security & Privacy - Always visible */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3">Data Protection</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Your personal information is encrypted and secure</li>
                  <li>• Test results are only shared with authorized personnel</li>
                  <li>• You control who receives your information</li>
                  <li>• All access is logged for compliance</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">Account Actions</h4>
                <div className="space-y-2">
                  {/* TODO: Implement Change Password functionality */}
                  {/* <Button variant="outline" size="sm">
                    Change Password
                  </Button> */}
                  {/* TODO: Implement Download My Data functionality */}
                  {/* <Button variant="outline" size="sm">
                    Download My Data
                  </Button> */}
                  {/* TODO: Implement Privacy Settings functionality */}
                  {/* <Button variant="outline" size="sm">
                    Privacy Settings
                  </Button> */}
                  <p className="text-sm text-muted-foreground">
                    Additional account features coming soon.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
