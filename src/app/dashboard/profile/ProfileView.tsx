'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { formatDateOnly } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Separator } from '@/components/ui/separator'
import { Edit, MailPlus, MessageSquare, Phone } from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import { z } from 'zod'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { useProfileFormOpts } from './use-profile-form-opts'
import type { Client, CompanyInfo } from '@/payload-types'

interface ProfileViewProps {
  user: Client
  companyContact?: CompanyInfo['contact']
}

type ReferralContact = {
  name?: string | null
  email?: string | null
}

type ReferralDocument = {
  name?: string | null
  contacts?: ReferralContact[] | null
  mainContactName?: string | null
  mainContactEmail?: string | null
  recipientEmails?: Array<{ email?: string | null }> | null
}

function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="py-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  value,
  children,
  required,
}: {
  label: string
  value?: ReactNode
  children?: ReactNode
  required?: boolean
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,640px)] sm:gap-8">
      <p className="text-foreground text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </p>
      <div className="text-muted-foreground min-w-0 text-sm">{children || value || 'Not provided'}</div>
    </div>
  )
}

function FormControlSlot({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl [&_[data-slot=field-label]]:sr-only [&_[data-slot=field]]:gap-2">{children}</div>
}

function getReferralTypeLabel(type?: string | null) {
  switch (type) {
    case 'court':
      return 'Court'
    case 'employer':
      return 'Employer'
    case 'self':
      return 'Self'
    default:
      return type || 'Not provided'
  }
}

function getReferralDocument(user: Client): ReferralDocument | null {
  if (!user?.referral) {
    return null
  }

  if (typeof user.referral === 'object' && 'value' in user.referral) {
    return user.referral.value as ReferralDocument
  }

  return user.referral as ReferralDocument
}

function getReferralContacts(referralDoc?: ReferralDocument | null): Array<{ name: string; email: string }> {
  const map = new Map<string, { name: string; email: string }>()
  const add = (contact?: ReferralContact | null) => {
    const email = typeof contact?.email === 'string' ? contact.email.trim() : ''
    if (!email) return

    const key = email.toLowerCase()
    const name = typeof contact?.name === 'string' ? contact.name.trim() : ''
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
    add(contact)
  }

  add({ name: referralDoc?.mainContactName, email: referralDoc?.mainContactEmail })
  for (const row of referralDoc?.recipientEmails || []) {
    add({ email: row?.email })
  }

  return Array.from(map.values())
}

function cleanPhoneNumber(phone?: string | null) {
  return phone ? phone.replace(/\D/g, '') : ''
}

export function ProfileView({ user, companyContact }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false)

  const formOpts = useProfileFormOpts({
    user,
    onSaved: () => setIsEditing(false),
  })

  const form = useAppForm({
    ...formOpts,
  })

  const emailValue = useStore(form.store, (state) => state.values.email)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const showEmailConfirmation = emailValue && emailValue !== user?.email

  const referralDoc = getReferralDocument(user)
  const referralContacts = getReferralContacts(referralDoc)
  const clientName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not provided'
  const preferredContactMethod = user?.preferredContactMethod?.replace('sms', 'Text/SMS') || 'Email'

  const selfAdditionalRecipients = (() => {
    const recipients = new Map<string, { name?: string; email: string }>()

    const add = (row?: { name?: string | null; email?: string | null } | null) => {
      const email = typeof row?.email === 'string' ? row.email.trim() : ''
      if (!email) return

      const key = email.toLowerCase()
      const name = typeof row?.name === 'string' ? row.name.trim() || undefined : undefined
      const existing = recipients.get(key)

      if (!existing) {
        recipients.set(key, { ...(name ? { name } : {}), email })
        return
      }

      if (!existing.name && name) {
        recipients.set(key, { name, email: existing.email })
      }
    }

    for (const row of user?.selfReferral?.recipients || []) add(row)
    for (const row of user?.referralAdditionalRecipients || []) add(row)

    return Array.from(recipients.values())
  })()

  const getReferralUpdateTemplate = (type: 'court' | 'employer') => {
    const clientEmail = user?.email || ''
    const recipientsList = referralContacts.map((row) => row.email).join(', ') || 'Not provided'
    const referralLabel = type === 'court' ? 'court/probation referral' : 'employment referral'
    const referralTitle = type === 'court' ? 'Court Name' : 'Employer'

    return {
      subject: `Referral information update request - ${clientName}`,
      body: `Hello MI Drug Test Team,

I need to request an update to my ${referralLabel} information in my client profile.

Client Information:
- Name: ${clientName}
- Email: ${clientEmail}
- Phone: ${user?.phone || 'Not provided'}

Current ${type === 'court' ? 'Court' : 'Employment'} Information:
- ${referralTitle}: ${referralDoc?.name || 'Not provided'}
- Recipients: ${recipientsList}

Requested update:
- 

Thank you,
${clientName}`,
    }
  }

  const getReferralUpdateLinks = (type: 'court' | 'employer') => {
    const template = getReferralUpdateTemplate(type)
    const supportEmail = companyContact?.email || 'mike@midrugtest.com'
    const supportPhone = cleanPhoneNumber(companyContact?.phone || '(231) 373-6341')
    const mailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`
    const smsHref = supportPhone
      ? `sms:${supportPhone}?&body=${encodeURIComponent(`${template.subject}\n\n${template.body}`)}`
      : ''
    const callHref = supportPhone ? `tel:${supportPhone}` : ''

    return {
      mailHref,
      smsHref,
      callHref,
    }
  }

  const renderRequestUpdateAction = (type: 'court' | 'employer') => {
    const { mailHref, smsHref, callHref } = getReferralUpdateLinks(type)

    return (
      <ButtonGroup>
        <Button asChild variant="outline" size="sm" className="shadow-none">
          <a href={mailHref}>
            <MailPlus className="h-4 w-4" />
            Email
          </a>
        </Button>
        {smsHref ? (
          <Button asChild variant="outline" size="sm" className="shadow-none">
            <a href={smsHref}>
              <MessageSquare className="h-4 w-4" />
              Text
            </a>
          </Button>
        ) : null}
        {callHref ? (
          <Button asChild variant="outline" size="sm" className="shadow-none">
            <a href={callHref}>
              <Phone className="h-4 w-4" />
              Call
            </a>
          </Button>
        ) : null}
      </ButtonGroup>
    )
  }

  const handleCancel = () => {
    form.reset()
    setIsEditing(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    await form.handleSubmit()
  }

  const renderReferralRows = () => (
    <>
      <SettingsRow label="Client type" value={getReferralTypeLabel(user?.referralType)} />

      {user?.referralType === 'court' && (
        <>
          <SettingsRow label="Court" value={referralDoc?.name || 'Not provided'} />
          {referralContacts.length > 0 ? (
            <SettingsRow label="Results sent to">
              <ul className="space-y-1">
                {referralContacts.map((recipient) => (
                  <li key={recipient.email}>
                    {recipient.name || 'Recipient'}{' '}
                    <span className="text-muted-foreground/80">({recipient.email})</span>
                  </li>
                ))}
              </ul>
            </SettingsRow>
          ) : null}
        </>
      )}

      {user?.referralType === 'employer' && (
        <>
          <SettingsRow label="Employer" value={referralDoc?.name || 'Not provided'} />
          {referralContacts.length > 0 ? (
            <SettingsRow label="Results sent to">
              <ul className="space-y-1">
                {referralContacts.map((recipient) => (
                  <li key={recipient.email}>
                    {recipient.name || 'Recipient'}{' '}
                    <span className="text-muted-foreground/80">({recipient.email})</span>
                  </li>
                ))}
              </ul>
            </SettingsRow>
          ) : null}
        </>
      )}

      {user?.referralType === 'self' && selfAdditionalRecipients.length > 0 ? (
        <SettingsRow label="Results also sent to">
          <ul className="space-y-1">
            {selfAdditionalRecipients.map((recipient) => (
              <li key={recipient.email}>
                {recipient.name || 'Recipient'} <span className="text-muted-foreground/80">({recipient.email})</span>
              </li>
            ))}
          </ul>
        </SettingsRow>
      ) : null}
    </>
  )

  const content = (
    <>
      <SettingsSection title="Personal details" description="Information used to identify you at testing.">
        <SettingsRow label="Name" required={isEditing} value={clientName}>
          {isEditing ? (
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2 [&_[data-slot=field-label]]:sr-only [&_[data-slot=field]]:gap-2 [&>div]:!col-span-1">
              <form.AppField
                name="firstName"
                validators={{
                  onChange: z.string().min(1, 'First name is required'),
                }}
              >
                {(formField) => <formField.TextField label="First Name" placeholder="First name" required />}
              </form.AppField>

              <form.AppField
                name="lastName"
                validators={{
                  onChange: z.string().min(1, 'Last name is required'),
                }}
              >
                {(formField) => <formField.TextField label="Last Name" placeholder="Last name" required />}
              </form.AppField>
            </div>
          ) : null}
        </SettingsRow>

        <SettingsRow label="Email" required={isEditing} value={user?.email || 'Not provided'}>
          {isEditing ? (
            <FormControlSlot>
              <form.AppField
                name="email"
                validators={{
                  onChange: z.string().email('Invalid email address').min(1, 'Email is required'),
                }}
              >
                {(formField) => <formField.EmailField label="Email Address" required />}
              </form.AppField>
            </FormControlSlot>
          ) : null}
        </SettingsRow>

        {isEditing && showEmailConfirmation ? (
          <SettingsRow label="Confirm email" required>
            <FormControlSlot>
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
                {(formField) => <formField.EmailField label="Confirm Email" required />}
              </form.AppField>
            </FormControlSlot>
          </SettingsRow>
        ) : null}

        <SettingsRow label="Phone" value={user?.phone || 'Not provided'}>
          {isEditing ? (
            <FormControlSlot>
              <form.AppField
                name="phone"
                validators={{
                  onChange: z
                    .string()
                    .optional()
                    .refine(
                      (val) => !val || /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(val),
                      {
                        message: 'Invalid phone number',
                      },
                    ),
                }}
              >
                {(formField) => <formField.PhoneField label="Phone Number" />}
              </form.AppField>
            </FormControlSlot>
          ) : null}
        </SettingsRow>

        <SettingsRow label="Date of birth" value={user?.dob ? formatDateOnly(user.dob) : 'Not provided'}>
          {isEditing ? (
            <FormControlSlot>
              <form.AppField
                name="dob"
                validators={{
                  onChange: z.union([z.string(), z.date()]).optional(),
                }}
              >
                {(formField) => <formField.DobField label="Date of Birth" />}
              </form.AppField>
            </FormControlSlot>
          ) : null}
        </SettingsRow>

        <SettingsRow
          label="Gender"
          value={<span className="capitalize">{user?.gender?.replace('-', ' ') || 'Not specified'}</span>}
        >
          {isEditing ? (
            <FormControlSlot>
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
            </FormControlSlot>
          ) : null}
        </SettingsRow>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Referral"
        description="Where your results are sent."
        action={
          user?.referralType === 'court' || user?.referralType === 'employer'
            ? renderRequestUpdateAction(user.referralType as 'court' | 'employer')
            : null
        }
      >
        {renderReferralRows()}
      </SettingsSection>

      <Separator />

      <SettingsSection title="Preferences" description="How you prefer to be contacted.">
        <SettingsRow
          label="Preferred contact method"
          value={<span className="capitalize">{preferredContactMethod}</span>}
        >
          {isEditing ? (
            <FormControlSlot>
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
            </FormControlSlot>
          ) : null}
        </SettingsRow>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Privacy"
        description="Your testing data is protected and shared only with authorized recipients."
      >
        <SettingsRow
          label="Data protection"
          value="Personal information and test results are handled through secure, access-controlled systems."
        />
      </SettingsSection>
    </>
  )

  return (
    <div className="py-4 md:py-6">
      <div className="px-6 lg:px-10 xl:px-12">
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-primary text-sm font-medium">Settings</p>
                <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">Profile</h1>
                <p className="text-muted-foreground mt-2">Manage your information</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            {content}
          </form>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-primary text-sm font-medium">Settings</p>
                <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">Profile</h1>
                <p className="text-muted-foreground mt-2">Manage your information</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
            {content}
          </>
        )}
      </div>
    </div>
  )
}
