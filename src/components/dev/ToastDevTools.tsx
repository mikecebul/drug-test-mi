'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { toast } from 'sonner'

type PlaywrightSuite = 'registration' | 'wizard' | 'smoke'

export function ToastDevTools() {
  const [isOpen, setIsOpen] = useState(false)
  const [runningSuite, setRunningSuite] = useState<PlaywrightSuite | null>(null)

  const runPlaywrightSuite = async (suite: PlaywrightSuite) => {
    setRunningSuite(suite)

    try {
      const response = await fetch('/api/dev/run-playwright', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suite }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        script?: string
        logPath?: string
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to start Playwright ${suite} suite`)
      }

      toast.success(`Playwright ${suite} started`, {
        description: data.logPath ? `Log: ${data.logPath}` : data.script,
      })
    } catch (error) {
      toast.error(`Playwright ${suite} failed to start`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setRunningSuite(null)
    }
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-[60]">
        <Button type="button" size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
          Dev Tools
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[20rem]">
      <Card className="border-border bg-card shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">Dev Tools</CardTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setIsOpen(false)}
            aria-label="Close dev tools"
          >
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                toast.success('Registration submitted successfully!', {
                  description: 'Account ready. Proceed to sign in and scheduling.',
                })
              }
            >
              Success
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                toast.error('Registration failed', {
                  description: 'Please review your information and try again.',
                })
              }
            >
              Error
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                toast.info('Redwood task queued', {
                  description: 'Worker will process this in the background.',
                })
              }
            >
              Info
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => toast.dismiss()}>
              Dismiss All
            </Button>
          </div>

          <div className="border-border space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">Playwright</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningSuite !== null}
                onClick={() => runPlaywrightSuite('registration')}
              >
                PW Registration
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningSuite !== null}
                onClick={() => runPlaywrightSuite('wizard')}
              >
                PW Wizard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningSuite !== null}
                onClick={() => runPlaywrightSuite('smoke')}
              >
                PW Smoke
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
