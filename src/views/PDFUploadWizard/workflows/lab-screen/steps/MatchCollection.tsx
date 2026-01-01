'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fetchPendingTests } from '@/views/PDFUploadWizard/actions'
import { useExtractPdfQuery } from '@/views/PDFUploadWizard/queries'
import { getRankedTestMatches, type DrugTest } from '@/views/PDFUploadWizard/utils/testMatching'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { cn } from '@/utilities/cn'
import { getLabScreenFormOpts } from '../shared-form'

export const MatchCollectionStep = withForm({
  ...getLabScreenFormOpts('matchCollection'),

  render: function Render({ form }) {
    const [isLoading, setIsLoading] = useState(true)
    const [pendingTests, setPendingTests] = useState<DrugTest[]>([])
    const [matchedTest, setMatchedTest] = useState<DrugTest | null>(null)
    const [showAllTests, setShowAllTests] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Get uploaded file from form to access extracted data
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, 'enter-lab-screen')

    useEffect(() => {
      async function loadPendingTests() {
        try {
          setIsLoading(true)
          const result = await fetchPendingTests(['collected']) // Only 'collected' tests
          if (!result.success) throw new Error(result.error)

          const tests = result.tests
          setPendingTests(tests)

          // Auto-match if we have extracted data
          if (extractData?.donorName || extractData?.collectionDate) {
            const testsWithScores = getRankedTestMatches(
              tests,
              extractData.donorName ?? null,
              extractData.collectionDate ?? null,
              extractData.testType,
              true, // isScreenWorkflow = true
            )

            if (testsWithScores.length > 0 && testsWithScores[0].score >= 60) {
              const bestMatch = testsWithScores[0]
              setMatchedTest(bestMatch.test)
              form.setFieldValue('matchCollection.testId', bestMatch.test.id)
              form.setFieldValue('matchCollection.clientName', bestMatch.test.clientName)
              form.setFieldValue('matchCollection.testType', bestMatch.test.testType)
              form.setFieldValue('matchCollection.collectionDate', bestMatch.test.collectionDate)
              form.setFieldValue('matchCollection.screeningStatus', bestMatch.test.screeningStatus)
              form.setFieldValue('matchCollection.matchType', bestMatch.score === 100 ? 'exact' : 'fuzzy')
              form.setFieldValue('matchCollection.score', bestMatch.score)
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
      form.setFieldValue('matchCollection.testId', test.id)
      form.setFieldValue('matchCollection.clientName', test.clientName)
      form.setFieldValue('matchCollection.testType', test.testType)
      form.setFieldValue('matchCollection.collectionDate', test.collectionDate)
      form.setFieldValue('matchCollection.screeningStatus', test.screeningStatus)
      form.setFieldValue('matchCollection.matchType', 'manual')
      form.setFieldValue('matchCollection.score', 100)
    }

    // Loading state
    if (isLoading) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Match Pending Test" description="Finding tests that match this screening" />
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

    // Error state
    if (error) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Match Pending Test" description="" />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )
    }

    // No tests found
    if (pendingTests.length === 0) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Match Pending Test" description="" />
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No pending tests found with status: collected</AlertDescription>
          </Alert>
        </div>
      )
    }

    // Calculate scores for all tests
    const testsWithScores = getRankedTestMatches(
      pendingTests,
      extractData?.donorName ?? null,
      extractData?.collectionDate ?? null,
      extractData?.testType,
      true, // isScreenWorkflow
    )

    // Show top 3 or all if requested
    const displayedTests = showAllTests ? testsWithScores : testsWithScores.slice(0, 3)

    return (
      <div className="space-y-8">
        <FieldGroupHeader
          title="Match Pending Test"
          description="Select the test that this screening result belongs to"
        />
        <div className="text-base md:text-lg">
          {extractData?.donorName && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Extracted from PDF:</strong> {extractData.donorName}
                {extractData.collectionDate && <span> • {format(new Date(extractData.collectionDate), 'PPp')}</span>}
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
                    isSelected ? 'border-primary ring-primary ring-2' : ''
                  }`}
                  onClick={() => handleTestSelect(test)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={test.clientHeadshot ?? undefined} alt={test.clientName} />
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
                        {isMediumConfidence && <Badge variant="secondary">Medium Match ({score}%)</Badge>}
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
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowAllTests(true)}>
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
      </div>
    )
  },
})
