'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { toast } from 'sonner'

type PlaywrightSuite = 'registration' | 'wizard' | 'smoke'
type RedwoodAction = 'import-inline' | 'import-queue' | 'headshot-inline' | 'headshot-queue'

export function ToastDevTools() {
  const [isOpen, setIsOpen] = useState(false)
  const [runningSuite, setRunningSuite] = useState<PlaywrightSuite | null>(null)
  const [runningRedwoodAction, setRunningRedwoodAction] = useState<RedwoodAction | null>(null)
  const [redwoodClientId, setRedwoodClientId] = useState('')

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

  const runRedwoodAction = async (action: RedwoodAction) => {
    const trimmedClientID = redwoodClientId.trim()
    if (!trimmedClientID) {
      toast.error('Client ID is required', {
        description: 'Enter a Payload client ID to run Redwood automation.',
      })
      return
    }

    setRunningRedwoodAction(action)

    try {
      const response = await fetch('/api/dev/redwood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: trimmedClientID,
          action,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        mode?: string
        task?: string
        jobId?: string
        status?: string
        screenshotPath?: string
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to run Redwood action: ${action}`)
      }

      const descriptionParts = [
        data.mode ? `Mode: ${data.mode}` : '',
        data.task ? `Task: ${data.task}` : '',
        data.jobId ? `Job: ${data.jobId}` : '',
        data.status ? `Status: ${data.status}` : '',
      ].filter(Boolean)

      toast.success(`Redwood ${action} completed`, {
        description: descriptionParts.join(' | ') || 'Completed successfully',
      })

      if (data.screenshotPath) {
        toast.info('Redwood screenshot captured', {
          description: data.screenshotPath,
        })
      }
    } catch (error) {
      toast.error(`Redwood ${action} failed`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setRunningRedwoodAction(null)
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
            <p className="text-muted-foreground text-xs font-medium">Redwood Jobs</p>
            <Input
              value={redwoodClientId}
              onChange={(event) => setRedwoodClientId(event.target.value)}
              placeholder="Client ID"
              aria-label="Client ID for Redwood job"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningRedwoodAction !== null}
                onClick={() => runRedwoodAction('import-inline')}
              >
                Import Inline
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningRedwoodAction !== null}
                onClick={() => runRedwoodAction('import-queue')}
              >
                Import Queue
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningRedwoodAction !== null}
                onClick={() => runRedwoodAction('headshot-inline')}
              >
                Headshot Inline
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runningRedwoodAction !== null}
                onClick={() => runRedwoodAction('headshot-queue')}
              >
                Headshot Queue
              </Button>
            </div>
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
