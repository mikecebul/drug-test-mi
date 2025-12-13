'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { format } from 'date-fns'
import { fetchPendingTests } from '../actions'
import { useExtractPdfQuery } from '../queries'
import { getRankedTestMatches, type DrugTest as TestMatchDrugTest, type TestType } from '../utils/testMatching'

// Export the schema for reuse in step validation
export const verifyTestFieldSchema = z.object({
  testId: z.string().min(1, 'Test selection is required'),
  clientName: z.string().min(1),
  testType: z.string().min(1),
  collectionDate: z.string().min(1),
  screeningStatus: z.string().min(1),
  matchType: z.enum(['exact', 'fuzzy', 'manual']),
  score: z.number().min(0).max(100),
})

type VerifyTestFields = {
  testId: string
  clientName: string
  testType: string
  collectionDate: string
  screeningStatus: string
  matchType: 'exact' | 'fuzzy' | 'manual'
  score: number
}

const defaultValues: VerifyTestFields = {
  testId: '',
  clientName: '',
  testType: '',
  collectionDate: '',
  screeningStatus: '',
  matchType: 'manual',
  score: 0,
}

// Use DrugTest type from testMatching utility
type DrugTest = TestMatchDrugTest

export const VerifyTestFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Verify Pending Test',
    description: '',
    filterStatus: ['collected'] as string[],
  },

  render: function Render({ group, title, description = '', filterStatus }) {
    const [isLoading, setIsLoading] = useState(true)
    const [pendingTests, setPendingTests] = useState<DrugTest[]>([])
    const [matchedTest, setMatchedTest] = useState<DrugTest | null>(null)
    const [showAllTests, setShowAllTests] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Get form values and uploaded file to access extracted data from query cache
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const uploadedFile = formValues?.uploadData?.file as File | null
    const uploadTestType = formValues?.uploadData?.testType as
      | '15-panel-instant'
      | '11-panel-lab'
      | '17-panel-sos-lab'
      | 'etg-lab'
      | undefined

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, uploadTestType)

    // Use the extracted test type if available (more accurate than the initial upload type)
    const detectedTestType = extractData?.testType || uploadTestType

    useEffect(() => {
      async function loadPendingTests() {
        try {
          setIsLoading(true)
          const result = await fetchPendingTests(filterStatus)
          if (!result.success) {
            throw new Error(result.error)
          }
          const tests = result.tests
          setPendingTests(tests)

          // Determine if this is a screen workflow (working with 'collected' tests)
          const isScreenWorkflow = filterStatus.includes('collected')

          // Auto-match if we have extracted data
          if (extractData?.donorName || extractData?.collectionDate) {
            const testsWithScores = getRankedTestMatches(
              tests,
              extractData.donorName ?? null,
              extractData.collectionDate ?? null,
              detectedTestType,
              isScreenWorkflow,
            )

            if (testsWithScores.length > 0 && testsWithScores[0].score >= 60) {
              // High confidence match
              const bestMatch = testsWithScores[0]
              setMatchedTest(bestMatch.test)
              group.setFieldValue('testId', bestMatch.test.id)
              group.setFieldValue('clientName', bestMatch.test.clientName)
              group.setFieldValue('testType', bestMatch.test.testType)
              group.setFieldValue('collectionDate', bestMatch.test.collectionDate)
              group.setFieldValue('screeningStatus', bestMatch.test.screeningStatus)
              group.setFieldValue('matchType', bestMatch.score === 100 ? 'exact' : 'fuzzy')
              group.setFieldValue('score', bestMatch.score)
            }
          }

          setIsLoading(false)
        } catch (err) {
          console.error('Failed to load pending tests:', err)
          setError(err instanceof Error ? err.message : 'Failed to load pending tests')
          setIsLoading(false)
        }
      }

      loadPendingTests()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleTestSelect = (test: DrugTest) => {
      setMatchedTest(test)
      group.setFieldValue('testId', test.id)
      group.setFieldValue('clientName', test.clientName)
      group.setFieldValue('testType', test.testType)
      group.setFieldValue('collectionDate', test.collectionDate)
      group.setFieldValue('screeningStatus', test.screeningStatus)
      group.setFieldValue('matchType', 'manual')
      group.setFieldValue('score', 100)
    }

    if (isLoading) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Loading pending tests...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (error) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )
    }

    if (pendingTests.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No pending tests found with status: {filterStatus.join(', ')}</AlertDescription>
          </Alert>
        </div>
      )
    }

    // Determine if this is a screen workflow (working with 'collected' tests)
    const isScreenWorkflow = filterStatus.includes('collected')

    // Calculate scores for all tests with filtering
    const testsWithScores = getRankedTestMatches(
      pendingTests,
      extractData?.donorName ?? null,
      extractData?.collectionDate ?? null,
      detectedTestType,
      isScreenWorkflow,
    )

    // Show top 3 or all if requested
    const displayedTests = showAllTests ? testsWithScores : testsWithScores.slice(0, 3)

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {extractData?.donorName && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Extracted from PDF:</strong> {extractData.donorName}
              {extractData.collectionDate && (
                <span> • {format(new Date(extractData.collectionDate), 'PPp')}</span>
              )}
              {detectedTestType && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Detected Test Type: {detectedTestType}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {displayedTests.map(({ test, score }) => {
            const isSelected = matchedTest?.id === test.id
            const isHighConfidence = score >= 80
            const isMediumConfidence = score >= 60 && score < 80

            return (
              <Card
                key={test.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'border-primary ring-2 ring-primary' : ''
                }`}
                onClick={() => handleTestSelect(test)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={test.clientHeadshot ?? undefined} alt={test.clientName} />
                        <AvatarFallback className="text-sm">
                          {test.clientName.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {test.clientName}
                          {isSelected && <Check className="h-5 w-5 text-primary" />}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {format(new Date(test.collectionDate), 'PPp')} • {test.testType}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isHighConfidence && <Badge variant="default">High Match ({score}%)</Badge>}
                      {isMediumConfidence && (
                        <Badge variant="secondary">Medium Match ({score}%)</Badge>
                      )}
                      {!isHighConfidence && !isMediumConfidence && score > 0 && (
                        <Badge variant="outline">Low Match ({score}%)</Badge>
                      )}
                      {!isHighConfidence && !isMediumConfidence && score === 0 && (
                        <Badge variant="outline">Manual Selection</Badge>
                      )}
                      <Badge variant="outline">{test.screeningStatus}</Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {!showAllTests && testsWithScores.length > 3 && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowAllTests(true)}
          >
            <ChevronDown className="mr-2 h-4 w-4" />
            Show {testsWithScores.length - 3} more pending tests
          </Button>
        )}

        {!matchedTest && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please select a pending test to continue</AlertDescription>
          </Alert>
        )}
      </div>
    )
  },
})
