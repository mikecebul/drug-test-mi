'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  User,
  Calendar,
  FileText,
  XCircle,
  AlertTriangle,
  Bell,
  Loader2,
} from 'lucide-react'
import { createDrugTest, computeTestResultPreview } from '../actions'
import type { ClientMatch, VerifiedTestData } from '../types'

interface ConfirmStepProps {
  data: VerifiedTestData
  client: ClientMatch
  file: File
  onComplete: (testId: string) => void
  onBack: () => void
}

export function ConfirmStep({ data, client, file, onComplete, onBack }: ConfirmStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [preview, setPreview] = useState<{
    initialScreenResult: string
    expectedPositives: string[]
    unexpectedPositives: string[]
    unexpectedNegatives: string[]
    autoAccept: boolean
  } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)

  useEffect(() => {
    async function fetchPreview() {
      try {
        const result = await computeTestResultPreview(client.id, data.detectedSubstances)
        setPreview(result)
      } catch (err) {
        console.error('Failed to compute preview:', err)
      } finally {
        setLoadingPreview(false)
      }
    }
    fetchPreview()
  }, [client.id, data.detectedSubstances])

  const handleCreate = async () => {
    setLoading(true)
    setError('')

    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await createDrugTest({
        clientId: client.id,
        testType: data.testType,
        collectionDate: new Date(data.collectionDate).toISOString(),
        detectedSubstances: data.detectedSubstances,
        isDilute: data.isDilute,
        pdfBuffer: Array.from(new Uint8Array(arrayBuffer)),
        pdfFilename: file.name,
      })

      if (result.success && result.testId) {
        onComplete(result.testId)
      } else {
        setError(result.error || 'Unknown error occurred')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create drug test')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Confirm and Create</h2>
        <p className="text-muted-foreground">
          Review the final data before creating the drug test record
        </p>
      </div>

      <Card className="border-primary">
        <CardHeader className="bg-primary/5 dark:bg-primary/10">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Test Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Client
            </div>
            <div className="pl-6">
              <p className="text-lg font-semibold">
                {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                {client.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{client.email}</p>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Test Type
            </div>
            <p className="text-lg font-medium pl-6">{data.testType}</p>
          </div>

          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Collection Date
            </div>
            <p className="text-lg font-medium pl-6">
              {new Date(data.collectionDate).toLocaleString()}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Detected Substances
            </div>
            <div className="pl-6">
              {data.detectedSubstances.length > 0 ? (
                <div className="space-y-2">
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {data.detectedSubstances.length} Positive
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    {data.detectedSubstances.map((substance) => (
                      <Badge key={substance} variant="outline" className="text-xs">
                        {substance}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <Badge variant="default" className="bg-green-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  All Negative
                </Badge>
              )}
            </div>
          </div>

          {loadingPreview ? (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Computing test result classification...
              </div>
            </div>
          ) : preview ? (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Test Result Classification
              </div>
              <div className="pl-6 space-y-3">
                {preview.initialScreenResult === 'negative' && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription>
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        All Negative (Pass)
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                        No substances detected and no medications expected. This result will be automatically accepted.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {preview.initialScreenResult === 'expected-positive' && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription>
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Expected Positive (Pass)
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                        All detected substances match client's prescribed medications. This result will be automatically accepted.
                      </p>
                      {preview.expectedPositives.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-green-700 dark:text-green-300 mb-1">Expected substances:</p>
                          <div className="flex flex-wrap gap-1">
                            {preview.expectedPositives.map((substance) => (
                              <Badge key={substance} variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30">
                                {substance}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {preview.initialScreenResult === 'unexpected-positive' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold">Unexpected Positive (Fail)</p>
                      <p className="text-sm mt-1">
                        Detected substances that are NOT in client's prescribed medications. Manual review required.
                      </p>
                      {preview.unexpectedPositives.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs mb-1">Unexpected substances:</p>
                          <div className="flex flex-wrap gap-1">
                            {preview.unexpectedPositives.map((substance) => (
                              <Badge key={substance} variant="destructive" className="text-xs">
                                {substance}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {preview.initialScreenResult === 'unexpected-negative-critical' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold">Unexpected Negative - Critical (Fail)</p>
                      <p className="text-sm mt-1">
                        Critical prescribed medications were NOT detected in the test. This requires immediate review.
                      </p>
                      {preview.unexpectedNegatives.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs mb-1">Missing critical substances:</p>
                          <div className="flex flex-wrap gap-1">
                            {preview.unexpectedNegatives.map((substance) => (
                              <Badge key={substance} variant="destructive" className="text-xs">
                                {substance}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {preview.initialScreenResult === 'unexpected-negative-warning' && (
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Unexpected Negative - Warning (Pass with Note)
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                        Some prescribed medications were not detected, but they are not critical. This result will be automatically accepted with a note.
                      </p>
                      {preview.unexpectedNegatives.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">Missing substances:</p>
                          <div className="flex flex-wrap gap-1">
                            {preview.unexpectedNegatives.map((substance) => (
                              <Badge key={substance} variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30">
                                {substance}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {preview.initialScreenResult === 'mixed-unexpected' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold">Mixed Unexpected Results (Fail)</p>
                      <p className="text-sm mt-1">
                        Both unexpected positives and missing expected substances detected. Manual review required.
                      </p>
                      <div className="mt-2 space-y-2">
                        {preview.unexpectedPositives.length > 0 && (
                          <div>
                            <p className="text-xs mb-1">Unexpected positives:</p>
                            <div className="flex flex-wrap gap-1">
                              {preview.unexpectedPositives.map((substance) => (
                                <Badge key={substance} variant="destructive" className="text-xs">
                                  {substance}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {preview.unexpectedNegatives.length > 0 && (
                          <div>
                            <p className="text-xs mb-1">Missing expected:</p>
                            <div className="flex flex-wrap gap-1">
                              {preview.unexpectedNegatives.map((substance) => (
                                <Badge key={substance} variant="outline" className="text-xs">
                                  {substance}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Dilute Sample
            </div>
            <div className="pl-6">
              {data.isDilute ? (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="outline">No</Badge>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              PDF Document
            </div>
            <div className="pl-6">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Failed to create drug test</p>
            <p className="text-sm">{error}</p>
          </AlertDescription>
        </Alert>
      )}

      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
        <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription>
          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
            After creation, the system will automatically:
          </p>
          <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              Compare detected substances with client's medications
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              Calculate the test result classification
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              Send notification emails to appropriate recipients
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline" disabled={loading}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create Drug Test
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
