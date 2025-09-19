'use client'

import { formOptions } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { getClientSideURL } from '@/utilities/getURL'
import { toast } from 'sonner'

export type AccountFormType = {
  name: string
  email?: string
  confirmEmail?: string
  phone?: string
  password?: string
  passwordConfirm?: string
}

export const useAccountFormOpts = ({
  user,
}: {
  user: any
}) => {
  const queryClient = useQueryClient()
  return formOptions({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      confirmEmail: '',
      phone: user?.phone || '',
      password: '',
      passwordConfirm: '',
    } as AccountFormType,
    onSubmit: async ({ value: data, formApi: form }) => {
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
        const updateData: Partial<AccountFormType> = {}

        // Include name if it's provided and different from current
        if (data.name !== undefined && data.name.trim() !== (user.name || '').trim()) {
          updateData.name = data.name.trim()
        }

        // Include email if it's different from current email
        if (data.email !== undefined && data.email.trim() !== (user.email || '').trim()) {
          updateData.email = data.email.trim()
        }

        // Include phone if it's different from current phone
        if (data.phone !== undefined && data.phone.trim() !== (user.phone || '').trim()) {
          updateData.phone = data.phone.trim()
        }

        // Include password if it's provided
        if (data.password && data.password.trim()) {
          updateData.password = data.password.trim()
        }

        // Check if there's actually something to update
        if (Object.keys(updateData).length === 0) {
          toast.warning('No changes detected')
          return
        }

        const req = await fetch(`${getClientSideURL()}/api/clients/${user.id}`, {
          body: JSON.stringify(updateData),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        })

        const res = await req.json()

        if (req.status >= 400) {
          toast.error(res.errors?.[0]?.message || res.message || 'Failed to update account')
          return
        }

        // Invalidate and refetch user data
        queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        toast.success('Successfully updated account.')

        // Reset password fields if password was changed
        if (updateData.password) {
          form.setFieldValue('password', '')
          form.setFieldValue('passwordConfirm', '')
        }

        // Reset email confirmation field
        form.setFieldValue('confirmEmail', '')
      } catch (err) {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })
}