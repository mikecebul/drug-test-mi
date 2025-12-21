'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { format } from 'date-fns'
import { fetchPendingTests } from '../actions'
import { useExtractPdfQuery } from '../queries'
import { getRankedTestMatches, type DrugTest as TestMatchDrugTest } from '../utils/testMatching'
import type { WorkflowType } from '../types'
import { FieldGroupHeader } from '../components/FieldGroupHeader'
import { WizardSection } from '../components/WizardSection'
import { LoadingCard } from '../components/LoadingCard'

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

export type VerifyTestFields = {
  testId: string
  clientName: string
  testType: string
  collectionDate: string
  screeningStatus: string
  matchType: 'exact' | 'fuzzy' | 'manual'
  score: number
}

export const verifyTestDefaultValues: VerifyTestFields = {
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

// Export the render function for reuse in workflow-specific wrappers
export function RenderVerifyTestFieldGroup({ group, title, description = '', filterStatus, workflowType }: any) {
    const [isLoading, setIsLoading] = useState(true)
    const [pendingTests, setPendingTests] = useState<DrugTest[]>([])
    const [matchedTest, setMatchedTest] = useState<DrugTest | null>(null)
    const [showAllTests, setShowAllTests] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Get uploaded file to access extracted data from query cache
    const formValues = useStore(group.form.store, (state: any) => state.values)
    const uploadedFile = formValues?.uploadData?.file as File | null

    // Get extracted data from query cache (cached from ExtractFieldGroup)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, workflowType)

    // Use the extracted test type from the extractor (auto-detected for lab tests)
    const detectedTestType = extractData?.testType

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
        <WizardSection>
          <FieldGroupHeader title={title} description={description} />
          <LoadingCard message="Loading pending tests..." />
        </WizardSection>
      )
    }

    if (error) {
      return (
        <WizardSection>
          <FieldGroupHeader title={title} description={description} />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </WizardSection>
      )
    }

    if (pendingTests.length === 0) {
      return (
        <WizardSection>
          <FieldGroupHeader title={title} description={description} />
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No pending tests found with status: {filterStatus.join(', ')}
            </AlertDescription>
          </Alert>
        </WizardSection>
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
      <WizardSection>
        <FieldGroupHeader title={title} description={description} />
        <div className="space-y-6 text-base md:text-lg">
          {extractData?.donorName && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Extracted from PDF:</strong> {extractData.donorName}
                {extractData.collectionDate && (
                  <span> • {format(new Date(extractData.collectionDate), 'PPp')}</span>
                )}
                {detectedTestType && (
                  <span className="text-muted-foreground mt-1 block text-xs">
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
                      <div className="flex flex-1 items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={test.clientHeadshot ?? undefined}
                            alt={test.clientName}
                          />
                          <AvatarFallback className="text-sm">
                            {test.clientName
                              .split(' ')
                              .map((n) => n.charAt(0))
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {test.clientName}
                            {isSelected && <Check className="text-primary h-5 w-5" />}
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
      </WizardSection>
    )
}

// Base component with default props
export const BaseVerifyTestFieldGroup = withFieldGroup({
  defaultValues: verifyTestDefaultValues,

  props: {
    title: 'Verify Pending Test',
    description: '',
    filterStatus: ['collected'] as string[],
  },

  render: RenderVerifyTestFieldGroup,
})
