'use client'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Copy, Check, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface SuccessStepProps {
  clientName: string
  password: string
  onContinue: () => void
}

export function SuccessStep({ clientName, password, onContinue }: SuccessStepProps) {
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setPasswordCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch {
      toast.error('Failed to copy password')
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">Client Registered Successfully!</h3>
        <p className="text-muted-foreground mt-1">{clientName} has been added to the system.</p>
      </div>

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="space-y-3">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Client Password (Save this now!)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-amber-100 px-3 py-2 font-mono text-lg dark:bg-amber-900/50">
              {showPassword ? password : '••••••••••••'}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="shrink-0"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPassword}
              className="shrink-0"
            >
              {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            The client can use this password to log in and reset it later if they choose to use the
            dashboard.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Button onClick={onContinue} className="min-w-50">
          Continue with Collection
        </Button>
      </div>
    </div>
  )
}
