'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'

interface DrugTest {
  id: string
  relatedClient: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  collectionDate: string
  testType: string
  initialScreenResult?: string
  confirmationDecision?: string
  confirmationResults?: Array<{
    substance: string
    result?: string
  }>
  confirmationSubstances?: string[]
  isComplete: boolean
  processNotes?: string
}

const getTestStage = (test: DrugTest) => {
  if (!test.initialScreenResult) {
    return { stage: 'Awaiting Results', color: 'bg-gray-500', priority: 1 }
  }

  if (['negative', 'inconclusive'].includes(test.initialScreenResult)) {
    return test.isComplete
      ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
      : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
  }

  if (
    [
      'expected-positive',
      'unexpected-positive',
      'mixed-unexpected',
      'unexpected-negative-critical',
      'unexpected-negative-warning',
    ].includes(test.initialScreenResult)
  ) {
    if (!test.confirmationDecision || test.confirmationDecision === 'pending-decision') {
      return { stage: 'Awaiting Client Decision', color: 'bg-orange-500', priority: 2 }
    }

    if (test.confirmationDecision === 'accept') {
      return test.isComplete
        ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
        : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
    }

    if (test.confirmationDecision === 'request-confirmation') {
      // Check if all confirmation results are in
      const hasAllResults =
        test.confirmationResults &&
        test.confirmationSubstances &&
        test.confirmationResults.length === test.confirmationSubstances.length &&
        test.confirmationResults.every((r) => r.result)

      if (!hasAllResults) {
        return { stage: 'Pending Confirmation', color: 'bg-yellow-500', priority: 3 }
      }

      // All results are in
      return test.isComplete
        ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
        : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
    }
  }

  return { stage: 'Unknown', color: 'bg-gray-500', priority: 0 }
}

export function DrugTestTrackerClient() {
  const [tests, setTests] = useState<DrugTest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIncompleteTests() {
      try {
        const response = await fetch(
          '/api/drug-tests?where[isComplete][equals]=false&depth=1&limit=100',
        )
        const data = await response.json()
        setTests(data.docs || [])
      } catch (error) {
        console.error('Error fetching incomplete tests:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncompleteTests()
  }, [])

  const sortedTests = tests.sort((a, b) => {
    const aStage = getTestStage(a)
    const bStage = getTestStage(b)
    return aStage.priority - bStage.priority
  })

  const testsByStage = sortedTests.reduce(
    (acc, test) => {
      const { stage } = getTestStage(test)
      if (!acc[stage]) acc[stage] = []
      acc[stage].push(test)
      return acc
    },
    {} as Record<string, DrugTest[]>,
  )

  return (
    <ShadcnWrapper className="mx-auto flex flex-col">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Drug Test Tracker</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Track and manage drug tests that require attention
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <p>Loading incomplete tests...</p>
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          {Object.entries(testsByStage).map(([stage, stageTests]) => (
            <div key={stage}>
              <div className="mb-4 flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={`${getTestStage(stageTests[0]).color} px-3 py-1 ${getTestStage(stageTests[0]).color.includes('yellow') ? 'text-black' : 'text-white'}`}
                >
                  {stage}
                </Badge>
                <span className="text-muted-foreground text-sm">({stageTests.length} tests)</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
                {stageTests.map((test) => (
                  <Card key={test.id} className="">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg md:text-xl">
                            {test.relatedClient.firstName} {test.relatedClient.lastName}
                          </CardTitle>
                          <p className="text-muted-foreground text-sm md:text-base">
                            {test.relatedClient.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {test.testType?.replace('-', ' ') || 'Unknown'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-muted-foreground text-xs font-medium md:text-sm">
                            Collection Date:
                          </span>
                          <p className="text-sm md:text-base">
                            {test.collectionDate
                              ? new Date(test.collectionDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Not scheduled'}
                          </p>
                        </div>

                        {test.initialScreenResult && (
                          <div>
                            <span className="text-muted-foreground text-xs font-medium md:text-sm">
                              Screen Result:
                            </span>
                            <p className="text-sm capitalize md:text-base">
                              {test.initialScreenResult.replace('-', ' ')}
                            </p>
                          </div>
                        )}

                        {test.confirmationDecision === 'request-confirmation' && (
                          <div>
                            <span className="text-muted-foreground text-xs font-medium md:text-sm">
                              Confirmation:
                            </span>
                            <p className="text-sm md:text-base">
                              {test.confirmationResults &&
                              test.confirmationSubstances &&
                              test.confirmationResults.length ===
                                test.confirmationSubstances.length &&
                              test.confirmationResults.every((r) => r.result)
                                ? 'All results received'
                                : `Pending (${test.confirmationResults?.filter((r) => r.result).length || 0}/${test.confirmationSubstances?.length || 0})`}
                            </p>
                          </div>
                        )}

                        {test.processNotes && (
                          <div>
                            <span className="text-muted-foreground text-xs font-medium md:text-sm">
                              Notes:
                            </span>
                            <p className="line-clamp-2 text-sm md:text-base">{test.processNotes}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(`/admin/collections/drug-tests/${test.id}`, '_blank')
                          }
                        >
                          Edit Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/admin/collections/clients/${test.relatedClient.id}`,
                              '_blank',
                            )
                          }
                        >
                          View Client
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {tests.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No incomplete drug tests found.</p>
                <p className="text-muted-foreground mt-2 text-sm">All tests have been completed!</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ShadcnWrapper>
  )
}
