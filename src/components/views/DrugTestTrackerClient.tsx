'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

  if (['expected-positive', 'unexpected-positive'].includes(test.initialScreenResult)) {
    if (!test.confirmationDecision) {
      return { stage: 'Awaiting Client Decision', color: 'bg-orange-500', priority: 2 }
    }

    if (test.confirmationDecision === 'accept') {
      return test.isComplete
        ? { stage: 'Complete', color: 'bg-green-500', priority: 5 }
        : { stage: 'Ready to Complete', color: 'bg-blue-500', priority: 4 }
    }

    if (test.confirmationDecision === 'request-confirmation') {
      // Check if all confirmation results are in
      const hasAllResults = test.confirmationResults &&
        test.confirmationSubstances &&
        test.confirmationResults.length === test.confirmationSubstances.length &&
        test.confirmationResults.every(r => r.result)

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
        const response = await fetch('/api/drug-tests?where[isComplete][equals]=false&depth=1&limit=100')
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

  const testsByStage = sortedTests.reduce((acc, test) => {
    const { stage } = getTestStage(test)
    if (!acc[stage]) acc[stage] = []
    acc[stage].push(test)
    return acc
  }, {} as Record<string, DrugTest[]>)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Drug Test Tracker</h1>
        <p className="text-gray-600 mt-2">
          Track and manage drug tests that require attention
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p>Loading incomplete tests...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(testsByStage).map(([stage, stageTests]) => (
            <div key={stage}>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary" className={`${getTestStage(stageTests[0]).color} text-white px-3 py-1`}>
                  {stage}
                </Badge>
                <span className="text-sm text-gray-500">({stageTests.length} tests)</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stageTests.map((test) => (
                  <Card key={test.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {test.relatedClient.firstName} {test.relatedClient.lastName}
                          </CardTitle>
                          <p className="text-sm text-gray-500">{test.relatedClient.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {test.testType?.replace('-', ' ') || 'Unknown'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Collection Date:</span>
                          <p className="text-sm">
                            {test.collectionDate
                              ? new Date(test.collectionDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Not scheduled'
                            }
                          </p>
                        </div>

                        {test.initialScreenResult && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Screen Result:</span>
                            <p className="text-sm capitalize">
                              {test.initialScreenResult.replace('-', ' ')}
                            </p>
                          </div>
                        )}

                        {test.confirmationDecision === 'request-confirmation' && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Confirmation:</span>
                            <p className="text-sm">
                              {test.confirmationResults &&
                               test.confirmationSubstances &&
                               test.confirmationResults.length === test.confirmationSubstances.length &&
                               test.confirmationResults.every(r => r.result)
                                ? 'All results received'
                                : `Pending (${test.confirmationResults?.filter(r => r.result).length || 0}/${test.confirmationSubstances?.length || 0})`
                              }
                            </p>
                          </div>
                        )}

                        {test.processNotes && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Notes:</span>
                            <p className="text-sm text-gray-700 line-clamp-2">
                              {test.processNotes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/admin/collections/drug-tests/${test.id}`, '_blank')}
                        >
                          Edit Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/admin/collections/clients/${test.relatedClient.id}`, '_blank')}
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
              <CardContent className="text-center py-8">
                <p className="text-gray-500">No incomplete drug tests found.</p>
                <p className="text-sm text-gray-400 mt-2">All tests have been completed!</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  )
}