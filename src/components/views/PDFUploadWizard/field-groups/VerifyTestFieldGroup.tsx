'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { format } from 'date-fns'
import { fetchPendingTests } from '../actions'

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

interface DrugTest {
  id: string
  clientName: string
  testType: string
  collectionDate: string
  screeningStatus: string
}

function calculateTestMatchScore(
  extractedName: string | null,
  extractedDate: Date | null,
  test: DrugTest,
): number {
  let score = 0

  // Name matching (60 points max)
  if (extractedName) {
    const extractedLower = extractedName.toLowerCase().trim()
    const testNameLower = test.clientName.toLowerCase().trim()

    if (extractedLower === testNameLower) {
      score += 60 // Exact match
    } else if (testNameLower.includes(extractedLower) || extractedLower.includes(testNameLower)) {
      score += 40 // Partial match
    } else {
      // Check for similar names (last name match)
      const extractedParts = extractedLower.split(/\s+/)
      const testParts = testNameLower.split(/\s+/)
      const lastNameMatch = extractedParts.some((p) => testParts.includes(p))
      if (lastNameMatch) {
        score += 30
      }
    }
  }

  // Date matching (40 points max)
  if (extractedDate) {
    const extractedDateStr = format(extractedDate, 'yyyy-MM-dd')
    const testDateStr = test.collectionDate.split('T')[0]

    if (extractedDateStr === testDateStr) {
      score += 40 // Exact date match
    } else {
      // Check if within a few days
      const daysDiff = Math.abs(
        (new Date(extractedDateStr).getTime() - new Date(testDateStr).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      if (daysDiff <= 1) {
        score += 30 // Within 1 day
      } else if (daysDiff <= 3) {
        score += 20 // Within 3 days
      } else if (daysDiff <= 7) {
        score += 10 // Within a week
      }
    }
  }

  return score
}

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

    // Get extracted data from previous step
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const extractData = formValues.extractData

    useEffect(() => {
      async function loadPendingTests() {
        try {
          setIsLoading(true)
          const tests = await fetchPendingTests(filterStatus)
          setPendingTests(tests)

          // Auto-match if we have extracted data
          if (extractData?.donorName || extractData?.collectionDate) {
            const testsWithScores = tests.map((test) => ({
              test,
              score: calculateTestMatchScore(
                extractData.donorName,
                extractData.collectionDate,
                test,
              ),
            }))

            // Sort by score descending
            testsWithScores.sort((a, b) => b.score - a.score)

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

    // Calculate scores for all tests
    const testsWithScores = pendingTests.map((test) => ({
      test,
      score: calculateTestMatchScore(extractData?.donorName, extractData?.collectionDate, test),
    }))

    // Sort by score descending
    testsWithScores.sort((a, b) => b.score - a.score)

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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {test.clientName}
                        {isSelected && <Check className="h-5 w-5 text-primary" />}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {format(new Date(test.collectionDate), 'PPp')} • {test.testType}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isHighConfidence && <Badge variant="default">High Match ({score}%)</Badge>}
                      {isMediumConfidence && (
                        <Badge variant="secondary">Medium Match ({score}%)</Badge>
                      )}
                      {!isHighConfidence && !isMediumConfidence && score > 0 && (
                        <Badge variant="outline">Low Match ({score}%)</Badge>
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
