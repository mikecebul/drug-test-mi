'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { HeadshotCaptureCard } from '../../components'

interface SuccessStepProps {
  clientId: string
  firstName: string
  lastName: string
  email: string
  middleInitial?: string | null
  dob?: string | null
  phone?: string | null
  password: string
  onContinue: () => void
  returnTo?: string | null
}

export function SuccessStep({
  clientId,
  firstName,
  lastName,
  email,
  middleInitial,
  dob,
  phone,
  password,
  onContinue,
  returnTo,
}: SuccessStepProps) {
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const clientName = middleInitial ? `${firstName} ${middleInitial}. ${lastName}` : `${firstName} ${lastName}`

  // Determine button text based on where user came from
  const getButtonText = () => {
    if (returnTo === 'instant-test') {
      return 'Continue with 15 Panel Test'
    }
    if (returnTo === 'collect-lab') {
      return 'Continue with Lab Collection'
    }
    return 'Back to Workflow Selector'
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy password')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="mx-auto w-full max-w-xl border-2">
        <CardContent className="space-y-8 px-6 pt-12 pb-8">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="bg-success/10 rounded-full p-4">
              <CheckCircle2 className="text-success h-12 w-12" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-3">
            <h1 className="text-center text-4xl font-semibold text-balance">{clientName} Registered!</h1>
          </div>

          {/* Password Section */}
          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="font-medium">Client Password</h3>
            </div>

            {/* Password Display */}
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1 font-mono text-sm">{showPassword ? password : '•'.repeat(password.length)}</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="text-success h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Copy password</span>
              </Button>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              The client can use this password to log in and reset it later if they choose to use the dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Headshot Upload Section */}
      <div className="mx-auto w-full max-w-xl space-y-3">
        <div>
          <h3 className="text-lg font-medium">Add Headshot Photo (Optional)</h3>
          <p className="text-muted-foreground text-sm">Upload a photo to help identify the client</p>
        </div>
        <HeadshotCaptureCard
          client={{
            id: clientId,
            firstName,
            lastName,
            middleInitial,
            email,
            dob,
            phone,
            headshot: null,
            headshotId: null,
          }}
        />
      </div>

      {/* Action Button */}
      <div className="mx-auto w-full max-w-xl">
        <Button className="w-full cursor-pointer" size="lg" onClick={onContinue}>
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}
