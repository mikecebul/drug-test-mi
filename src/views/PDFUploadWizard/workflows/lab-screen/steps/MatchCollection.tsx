'use client'

import { useEffect, useState } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle, Check, ChevronDown, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { useExtractPdfQuery, useFetchPendingTestsQuery } from '@/views/PDFUploadWizard/queries'
import { getRankedTestMatches, type DrugTest } from '@/views/PDFUploadWizard/utils/testMatching'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { getLabScreenFormOpts } from '../shared-form'

export const MatchCollectionStep = withForm({
  ...getLabScreenFormOpts('matchCollection'),

  render: function Render({ form }) {
    const [matchedTest, setMatchedTest] = useState<DrugTest | null>(null)
    const [showAllTests, setShowAllTests] = useState(false)

    // Get uploaded file from form to access extracted data
    const uploadedFile = useStore(form.store, (state) => state.values.upload.file)
    const { data: extractData } = useExtractPdfQuery(uploadedFile, 'enter-lab-screen')

    // Fetch pending tests using query hook
    const { data: pendingTests, isLoading, error: queryError } = useFetchPendingTestsQuery(['collected'])

    // Restore previous selection or auto-match if we have extracted data
    useEffect(() => {
      if (!pendingTests || pendingTests.length === 0) return

      // Check if we already have a selection in the form
      const existingTestId = form.getFieldValue('matchCollection.testId')
      if (existingTestId) {
        // Restore local state from form values
        if (!matchedTest) {
          const test = pendingTests.find((t) => t.id === existingTestId)
          if (test) setMatchedTest(test)
        }
        return
      }

      // Only auto-match if we don't have a selection yet and have extracted data
      if (!extractData) return

      if (extractData?.donorName || extractData?.collectionDate) {
        const testsWithScores = getRankedTestMatches(
          pendingTests,
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
          form.setFieldValue('matchCollection.headshot', bestMatch.test.clientHeadshot)
          form.setFieldValue('matchCollection.testType', bestMatch.test.testType)
          form.setFieldValue('matchCollection.collectionDate', bestMatch.test.collectionDate)
          form.setFieldValue('matchCollection.screeningStatus', bestMatch.test.screeningStatus)
          form.setFieldValue('matchCollection.matchType', bestMatch.score === 100 ? 'exact' : 'fuzzy')
          form.setFieldValue('matchCollection.score', bestMatch.score)
          // Auto-sync extracted data to form when available
          form.setFieldValue('labScreenData.collectionDate', bestMatch.test.collectionDate)
          if (bestMatch.test.testType !== '15-panel-instant')
            form.setFieldValue(
              'labScreenData.testType',
              bestMatch.test.testType as '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab',
            )
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingTests, extractData])

    const handleTestSelect = (test: DrugTest) => {
      setMatchedTest(test)
      form.setFieldValue('matchCollection.testId', test.id)
      form.setFieldValue('matchCollection.clientName', test.clientName)
      form.setFieldValue('matchCollection.headshot', test.clientHeadshot)
      form.setFieldValue('matchCollection.testType', test.testType)
      form.setFieldValue('matchCollection.collectionDate', test.collectionDate)
      form.setFieldValue('matchCollection.screeningStatus', test.screeningStatus)
      form.setFieldValue('matchCollection.matchType', 'manual')
      form.setFieldValue('matchCollection.score', 100)

      // Auto-sync extracted data to form when available
      form.setFieldValue('labScreenData.collectionDate', test.collectionDate)
      if (test.testType !== '15-panel-instant')
        form.setFieldValue('labScreenData.testType', test.testType as '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab')
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
    if (queryError) {
      return (
        <div className="space-y-8">
          <FieldGroupHeader title="Match Pending Test" description="" />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {queryError instanceof Error ? queryError.message : 'Failed to load pending tests'}
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    // No tests found
    if (!pendingTests || pendingTests.length === 0) {
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
        <div className="space-y-8 text-base md:text-lg">
          {extractData?.donorName && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>
                <strong>Extracted from PDF:</strong> {extractData.donorName}
              </AlertTitle>
              <AlertDescription>
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
