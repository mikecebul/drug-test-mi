'use client'

import { formOptions } from '@tanstack/react-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export type ProfileFormType = {
  firstName: string
  lastName: string
  email: string
  confirmEmail?: string
  phone?: string
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say'
  dob?: string
  preferredContactMethod: 'email' | 'phone' | 'sms'
  // Client type specific fields
  courtInfo?: {
    courtName: string
    probationOfficerName: string
    probationOfficerEmail: string
  }
  employmentInfo?: {
    employerName: string
    contactName: string
    contactEmail: string
  }
  alternativeRecipient?: {
    name: string
    email: string
  }
}

export const useProfileFormOpts = ({
  user,
}: {
  user: any
}) => {
  const router = useRouter()

  return formOptions({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      confirmEmail: '',
      phone: user?.phone || '',
      gender: user?.gender || '',
      dob: user?.dob || '',
      preferredContactMethod: user?.preferredContactMethod || 'email',
      courtInfo: user?.courtInfo || undefined,
      employmentInfo: user?.employmentInfo || undefined,
      alternativeRecipient: user?.alternativeRecipient || undefined,
    } as ProfileFormType,
    onSubmit: async ({ value: data }) => {
      if (!user) {
        toast.error('User not found')
        return
      }

      try {
        // Validate email confirmation if email is being changed
        if (data.email && data.email !== user.email) {
          if (!data.confirmEmail || data.confirmEmail !== data.email) {
            toast.error('Email confirmation is required when changing email address')
            return
          }
        }

        // Prepare the data to send - only include fields that have values and are different
        const updateData: Partial<ProfileFormType> = {}

        // Include firstName if it's different from current
        if (data.firstName !== undefined && data.firstName.trim() !== (user.firstName || '').trim()) {
          updateData.firstName = data.firstName.trim()
        }

        // Include lastName if it's different from current
        if (data.lastName !== undefined && data.lastName.trim() !== (user.lastName || '').trim()) {
          updateData.lastName = data.lastName.trim()
        }

        // Include email if it's different from current email
        if (data.email !== undefined && data.email.trim() !== (user.email || '').trim()) {
          updateData.email = data.email.trim()
        }

        // Include phone if it's different from current phone
        if (data.phone !== undefined && data.phone.trim() !== (user.phone || '').trim()) {
          updateData.phone = data.phone.trim()
        }

        // Include gender if it's different
        if (data.gender !== user.gender) {
          updateData.gender = data.gender
        }

        // Include dob if it's different
        if (data.dob !== user.dob) {
          updateData.dob = data.dob
        }

        // Include preferredContactMethod if it's different
        if (data.preferredContactMethod !== user.preferredContactMethod) {
          updateData.preferredContactMethod = data.preferredContactMethod
        }

        // Include client type specific fields if they're different
        if (user.clientType === 'probation' && data.courtInfo) {
          const currentCourtInfo = user.courtInfo || {}
          const hasCourtChanges =
            data.courtInfo.courtName !== currentCourtInfo.courtName ||
            data.courtInfo.probationOfficerName !== currentCourtInfo.probationOfficerName ||
            data.courtInfo.probationOfficerEmail !== currentCourtInfo.probationOfficerEmail

          if (hasCourtChanges) {
            updateData.courtInfo = data.courtInfo
          }
        }

        if (user.clientType === 'employment' && data.employmentInfo) {
          const currentEmploymentInfo = user.employmentInfo || {}
          const hasEmploymentChanges =
            data.employmentInfo.employerName !== currentEmploymentInfo.employerName ||
            data.employmentInfo.contactName !== currentEmploymentInfo.contactName ||
            data.employmentInfo.contactEmail !== currentEmploymentInfo.contactEmail

          if (hasEmploymentChanges) {
            updateData.employmentInfo = data.employmentInfo
          }
        }

        if (user.clientType === 'self' && data.alternativeRecipient) {
          const currentAlternativeRecipient = user.alternativeRecipient || {}
          const hasAlternativeRecipientChanges =
            data.alternativeRecipient.name !== currentAlternativeRecipient.name ||
            data.alternativeRecipient.email !== currentAlternativeRecipient.email

          if (hasAlternativeRecipientChanges) {
            updateData.alternativeRecipient = data.alternativeRecipient
          }
        }

        // Check if there's actually something to update
        if (Object.keys(updateData).length === 0) {
          toast.warning('No changes detected')
          return
        }

        // Update the profile using Payload's API
        const response = await fetch(`/api/clients/${user.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.errors?.[0]?.message || errorData.message || 'Failed to update profile')
        }

        // Refresh the page to get fresh data
        router.refresh()
        toast.success('Successfully updated profile.')
      } catch (err) {
        console.error('Profile update error:', err)
        toast.error('Something went wrong. Please try again.')
      }
    },
  })
}