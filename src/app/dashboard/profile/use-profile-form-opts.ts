'use client'

import { formOptions } from '@tanstack/react-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { updateClientContactProfileAction } from './actions'

export type ProfileFormType = {
  email: string
  confirmEmail?: string
  phone?: string
  preferredContactMethod: 'email' | 'phone' | 'sms'
}

export const useProfileFormOpts = ({
  user,
  onSuccess,
}: {
  user: {
    email?: string | null
    phone?: string | null
    preferredContactMethod?: 'email' | 'phone' | 'sms' | null
  }
  onSuccess?: () => void
}) => {
  const router = useRouter()

  return formOptions({
    defaultValues: {
      email: user?.email || '',
      confirmEmail: '',
      phone: user?.phone || '',
      preferredContactMethod: user?.preferredContactMethod || 'email',
    } as ProfileFormType,
    onSubmit: async ({ value: data }) => {
      try {
        const nextEmail = data.email.trim()
        const nextPhone = data.phone?.trim() || ''
        const currentEmail = (user.email || '').trim()
        const currentPhone = (user.phone || '').trim()

        if (nextEmail !== currentEmail) {
          if (!data.confirmEmail || data.confirmEmail.trim() !== nextEmail) {
            toast.error('Email confirmation is required when changing your email address.')
            return
          }
        }

        const result = await updateClientContactProfileAction({
          ...(nextEmail !== currentEmail ? { email: nextEmail } : {}),
          ...(nextPhone !== currentPhone ? { phone: nextPhone } : {}),
          ...(data.preferredContactMethod !== user.preferredContactMethod
            ? { preferredContactMethod: data.preferredContactMethod }
            : {}),
        })

        if (!result.success) {
          if (result.error === 'No changes detected.') {
            toast.warning(result.error)
            return
          }

          throw new Error(result.error || 'Failed to update profile.')
        }

        router.refresh()
        onSuccess?.()
        toast.success('Contact preferences updated.')
      } catch (error) {
        console.error('Profile update error:', error)
        toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
      }
    },
  })
}
