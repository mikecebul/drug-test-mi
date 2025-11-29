'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Plus, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type RecipientEditorProps = {
  initialRecipients: string[]
  onChange: (recipients: string[]) => void
  label: string
  required?: boolean
  maxRecipients?: number
}

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RecipientEditor({
  initialRecipients,
  onChange,
  label,
  required = false,
  maxRecipients = 10,
}: RecipientEditorProps) {
  const [recipients, setRecipients] = useState<string[]>(initialRecipients)
  const [errors, setErrors] = useState<Record<number, string>>({})

  const handleAddRecipient = () => {
    if (recipients.length >= maxRecipients) return
    const newRecipients = [...recipients, '']
    setRecipients(newRecipients)
    onChange(newRecipients)
  }

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index)
    setRecipients(newRecipients)
    onChange(newRecipients)

    // Clear error for this index
    const newErrors = { ...errors }
    delete newErrors[index]
    setErrors(newErrors)
  }

  const handleUpdateRecipient = (index: number, value: string) => {
    const newRecipients = [...recipients]
    newRecipients[index] = value
    setRecipients(newRecipients)
    onChange(newRecipients)

    // Clear error while typing
    if (errors[index]) {
      const newErrors = { ...errors }
      delete newErrors[index]
      setErrors(newErrors)
    }
  }

  const handleBlur = (index: number) => {
    const email = recipients[index].trim()
    if (!email) return // Empty is OK unless required

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      setErrors({ ...errors, [index]: 'Invalid email format' })
      return
    }

    // Check for duplicates
    const duplicateIndex = recipients.findIndex(
      (r, i) => i !== index && r.trim().toLowerCase() === email.toLowerCase(),
    )
    if (duplicateIndex !== -1) {
      setErrors({ ...errors, [index]: 'Duplicate email address' })
      return
    }

    // Clear error if valid
    const newErrors = { ...errors }
    delete newErrors[index]
    setErrors(newErrors)
  }

  const validRecipients = recipients.filter((r) => r.trim() && EMAIL_REGEX.test(r.trim()))
  const hasErrors = Object.keys(errors).length > 0
  const missingRequired = required && validRecipients.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRecipient}
          disabled={recipients.length >= maxRecipients}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Recipient
        </Button>
      </div>

      {missingRequired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>At least one recipient is required</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {recipients.map((email, index) => {
          const isOriginal = index < initialRecipients.length
          const hasChanged = isOriginal && email !== initialRecipients[index]

          return (
            <div key={index} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => handleUpdateRecipient(index, e.target.value)}
                  onBlur={() => handleBlur(index)}
                  placeholder="email@example.com"
                  className={errors[index] ? 'border-destructive' : ''}
                />
                {hasChanged && (
                  <div className="absolute right-2 top-2 text-xs text-amber-600">Modified</div>
                )}
                {errors[index] && (
                  <p className="mt-1 text-xs text-destructive">{errors[index]}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRecipient(index)}
                disabled={required && validRecipients.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <div className="text-sm text-muted-foreground">
        {validRecipients.length} valid recipient{validRecipients.length !== 1 ? 's' : ''}
        {initialRecipients.length > 0 && (
          <>
            {' '}
            • {recipients.length - initialRecipients.length > 0 ? 'Added' : 'Removed'}{' '}
            {Math.abs(recipients.length - initialRecipients.length)} from original
          </>
        )}
      </div>
    </div>
  )
}
