'use client'

import React from 'react'
import { useStore, formOptions } from '@tanstack/react-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAppForm } from '@/blocks/Form/hooks/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

export function ClientEmailDialog({
  open,
  onOpenChange,
  clientId,
  currentEmail,
  onSaved,
}: ClientEmailDialogProps) {
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client Email</DialogTitle>
          <DialogDescription>Update the client profile email used for notifications.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            event.stopPropagation()
            await form.handleSubmit()
          }}
          className="space-y-4"
        >
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Email
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
