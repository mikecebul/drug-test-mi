'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'
import { getCurrentUserEmail } from './actions'

interface ResendVerificationFormProps {
  showLoginMessage?: boolean
}

export const ResendVerificationForm = ({ showLoginMessage = false }: ResendVerificationFormProps) => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Extract email from current user session on component mount
  useEffect(() => {
    const extractEmail = async () => {
      try {
        const email = await getCurrentUserEmail()
        if (email) {
          setEmail(email)
        }
      } catch (_error) {
        // Silently fail - user can manually enter email
      }
    }

    extractEmail()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Please enter your email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/clients/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setIsSuccess(true)
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        const result = await response.json()
        toast.error(result.errors?.[0]?.message || result.message || 'Failed to send verification email')
      }
    } catch (_error) {
      toast.error('Network error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Mail className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="text-xl font-semibold">Email Sent!</h3>
            <p className="text-muted-foreground">
              We&apos;ve sent a new verification email to <strong>{email}</strong>.
              Please check your inbox and follow the verification link.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Email Verification Required</CardTitle>
        {showLoginMessage && (
          <p className="text-center text-muted-foreground">
            Your account needs to be verified before you can sign in. Please check your email or request a new verification email below.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Resend Verification Email'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}