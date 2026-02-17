'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag('error_source', 'react-error-boundary')
      scope.setContext('react_error_info', {
        componentStack: errorInfo.componentStack,
      })
      Sentry.captureException(error)
    })
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Something went wrong
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    We encountered an unexpected error while loading your dashboard.
                    Please try refreshing the page or contact support if the problem persists.
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium">Error Details</summary>
                      <pre className="mt-2 bg-muted p-4 rounded text-sm overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.location.reload()}
                      variant="default"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Page
                    </Button>
                    <Button
                      onClick={() => this.setState({ hasError: false })}
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
