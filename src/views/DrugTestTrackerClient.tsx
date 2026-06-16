'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { ConfirmationSubstanceSelector } from '@/blocks/Form/field-components/confirmation-substance-selector'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

export interface DrugTest {
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
  unexpectedPositives?: string[]
  isComplete: boolean
  processNotes?: string
}

interface DrugTestTrackerClientProps {
  initialError?: string | null
  initialTests: DrugTest[]
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

export function DrugTestTrackerClient({ initialError = null, initialTests }: DrugTestTrackerClientProps) {
  const [tests, setTests] = useState<DrugTest[]>(initialTests)
  const [updatingTests, setUpdatingTests] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(initialError)

  function applyUpdatedTest(
    testId: string,
    updatedTest: Partial<DrugTest> | undefined,
    fallbackUpdate?: Partial<DrugTest>,
  ) {
    if (updatedTest?.id) {
      setTests((prev) => {
        if (updatedTest.isComplete) {
          return prev.filter((test) => test.id !== testId)
        }

        return prev.map((test) => {
          if (test.id !== testId) return test

          return {
            ...test,
            ...updatedTest,
            relatedClient:
              updatedTest.relatedClient && typeof updatedTest.relatedClient === 'object'
                ? updatedTest.relatedClient
                : test.relatedClient,
          }
        })
      })
      return
    }

    if (fallbackUpdate) {
      setTests((prev) => prev.map((test) => (test.id === testId ? { ...test, ...fallbackUpdate } : test)))
      return
    }

    setTests((prev) => prev.filter((test) => test.id !== testId))
  }

  async function markAsAccepted(testId: string) {
    setActionError(null)
    setUpdatingTests((prev) => ({ ...prev, [testId]: true }))

    try {
      const response = await fetch(`/api/drug-tests/${testId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationDecision: 'accept',
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update test (${response.status})`)
      }

      const data = await response.json()
      const updatedTest = (data?.doc ?? data) as Partial<DrugTest> | undefined
      applyUpdatedTest(testId, updatedTest)
    } catch (error) {
      console.error('Error marking test as accepted:', error)
      setActionError('Unable to mark test as accepted. Please try again.')
    } finally {
      setUpdatingTests((prev) => {
        const next = { ...prev }
        delete next[testId]
        return next
      })
    }
  }

  async function requestConfirmation(testId: string, confirmationSubstances: string[]) {
    if (confirmationSubstances.length === 0) {
      setActionError('Select at least one substance to request confirmation.')
      return
    }

    setActionError(null)
    setUpdatingTests((prev) => ({ ...prev, [testId]: true }))

    try {
      const response = await fetch(`/api/drug-tests/${testId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationDecision: 'request-confirmation',
          confirmationSubstances,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update test (${response.status})`)
      }

      const data = await response.json()
      const updatedTest = (data?.doc ?? data) as Partial<DrugTest> | undefined
      applyUpdatedTest(testId, updatedTest, {
        confirmationDecision: 'request-confirmation',
        confirmationSubstances,
        isComplete: false,
      })
    } catch (error) {
      console.error('Error requesting confirmation:', error)
      setActionError('Unable to request confirmation. Please try again.')
    } finally {
      setUpdatingTests((prev) => {
        const next = { ...prev }
        delete next[testId]
        return next
      })
    }
  }

  const sortedTests = [...tests].sort((a, b) => {
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
        <p className="text-muted-foreground mt-2 text-lg">Track and manage drug tests that require attention</p>
        {actionError && <p className="mt-3 text-sm font-medium text-red-600">{actionError}</p>}
      </div>

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
                        <p className="text-muted-foreground text-sm md:text-base">{test.relatedClient.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {test.testType?.replace('-', ' ') || 'Unknown'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground text-xs font-medium md:text-sm">Collection Date:</span>
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
                          <span className="text-muted-foreground text-xs font-medium md:text-sm">Screen Result:</span>
                          <p className="text-sm capitalize md:text-base">
                            {test.initialScreenResult.replace('-', ' ')}
                          </p>
                        </div>
                      )}

                      {test.confirmationDecision === 'request-confirmation' && (
                        <div>
                          <span className="text-muted-foreground text-xs font-medium md:text-sm">Confirmation:</span>
                          <p className="text-sm md:text-base">
                            {test.confirmationResults &&
                            test.confirmationSubstances &&
                            test.confirmationResults.length === test.confirmationSubstances.length &&
                            test.confirmationResults.every((r) => r.result)
                              ? 'All results received'
                              : `Pending (${test.confirmationResults?.filter((r) => r.result).length || 0}/${test.confirmationSubstances?.length || 0})`}
                          </p>
                        </div>
                      )}

                      {test.processNotes && (
                        <div>
                          <span className="text-muted-foreground text-xs font-medium md:text-sm">Notes:</span>
                          <p className="line-clamp-2 text-sm md:text-base">{test.processNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {stage === 'Awaiting Client Decision' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => markAsAccepted(test.id)}
                            disabled={Boolean(updatingTests[test.id])}
                          >
                            {updatingTests[test.id] ? 'Accepting...' : 'Mark Accepted'}
                          </Button>
                          <RequestConfirmationDialog
                            disabled={Boolean(updatingTests[test.id])}
                            isSubmitting={Boolean(updatingTests[test.id])}
                            test={test}
                            onConfirm={(substances) => requestConfirmation(test.id, substances)}
                          />
                        </>
                      )}
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
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No incomplete drug tests found.</p>
              <p className="text-muted-foreground mt-2 text-sm">All tests have been completed!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ShadcnWrapper>
  )
}

function RequestConfirmationDialog({
  disabled,
  isSubmitting,
  onConfirm,
  test,
}: {
  disabled: boolean
  isSubmitting: boolean
  onConfirm: (substances: string[]) => Promise<void>
  test: DrugTest
}) {
  const unexpectedPositives = test.unexpectedPositives ?? []
  const [open, setOpen] = useState(false)
  const [selectedSubstances, setSelectedSubstances] = useState<string[]>(unexpectedPositives)
  const [error, setError] = useState<string | undefined>()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setError(undefined)

    if (nextOpen) {
      setSelectedSubstances(unexpectedPositives)
    }
  }

  const handleConfirm = async () => {
    if (selectedSubstances.length === 0) {
      setError('Select at least one substance for confirmation.')
      return
    }

    await onConfirm(selectedSubstances)
    setOpen(false)
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled || unexpectedPositives.length === 0}>
          Request Confirmation
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(44rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader className="border-border border-b px-6 py-5">
          <DrawerTitle className="text-2xl tracking-tight">Request Confirmation</DrawerTitle>
          <DrawerDescription>
            Select the unexpected positive substances that should be sent for confirmation testing.
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {unexpectedPositives.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No unexpected positive substances are available for this test. Edit the test if confirmation is still
              needed.
            </p>
          ) : (
            <ConfirmationSubstanceSelector
              unexpectedPositives={unexpectedPositives}
              selectedSubstances={selectedSubstances}
              onSelectionChange={(substances) => {
                setSelectedSubstances(substances)
                setError(undefined)
              }}
              error={error}
            />
          )}
        </div>

        <DrawerFooter className="border-border border-t px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || selectedSubstances.length === 0}
          >
            {isSubmitting ? 'Requesting...' : 'Request Confirmation'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
