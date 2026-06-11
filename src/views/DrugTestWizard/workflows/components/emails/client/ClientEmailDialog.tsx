'use client'

import React from 'react'
import { useStore, formOptions } from '@tanstack/react-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { updateClientEmail } from './updateClientEmail'

const clientEmailSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
})

type ClientEmailFormValues = z.infer<typeof clientEmailSchema>

type ClientEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null
  currentEmail: string
  onSaved: (data: { email: string }) => void
}

export function ClientEmailDialog({ open, onOpenChange, clientId, currentEmail, onSaved }: ClientEmailDialogProps) {
  const initialValues = React.useMemo<ClientEmailFormValues>(() => ({ email: currentEmail || '' }), [currentEmail])
  const wasOpenRef = React.useRef(false)

  const form = useAppForm(
    formOptions({
      defaultValues: initialValues,
      canSubmitWhenInvalid: true,
      validators: {
        onSubmit: ({ formApi }) => formApi.parseValuesWithSchema(clientEmailSchema),
      },
      onSubmit: async ({ value }) => {
        if (!clientId) {
          toast.error('Client is missing, cannot update email')
          return
        }

        const result = await updateClientEmail({
          clientId,
          email: value.email.trim(),
        })

        if (!result.success || !result.data) {
          toast.error(result.error || 'Failed to update client email')
          return
        }

        onSaved({ email: result.data.email })
        toast.success('Client email updated')
        onOpenChange(false)
      },
    }),
  )

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.reset(initialValues)
    }

    wasOpenRef.current = open
  }, [form, initialValues, open])

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset(initialValues)
    }

    onOpenChange(nextOpen)
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={handleDialogOpenChange}>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(32rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b px-6 py-5">
          <DrawerTitle className="text-2xl tracking-tight">Edit Client Email</DrawerTitle>
          <DrawerDescription>Update the client profile email used for notifications.</DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            event.stopPropagation()
            await form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Client Email Address</Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="client@example.com"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          </div>

          <DrawerFooter className="border-border border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Email
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
