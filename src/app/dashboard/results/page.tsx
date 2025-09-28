'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, AlertCircle, MessageSquare } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { DrugTest, PrivateMedia } from '@/payload-types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
// Removed unused pagination and popover imports to reduce bundle size
import { CheckCircle, Circle, Clock, Truck, FlaskConical, FileCheck } from 'lucide-react'

type DrugTestResult = DrugTest & {
  testDocument?: PrivateMedia
}

// Chain of custody step interface
interface CustodyStep {
  label: string
  icon: React.ComponentType<{ className?: string }>
  completed: boolean
  current?: boolean
}

// Generate chain of custody steps based on test data
function generateCustodyChain(result: DrugTestResult): CustodyStep[] {
  const isLabTest = result.testType === '11-panel-lab'
  const isInstantTest = result.testType === '15-panel-instant'

  // Use new workflow fields
  const hasInitialResult = result.initialScreenResult
  const confirmationDecision = result.confirmationDecision
  const isConfirmationRequested = confirmationDecision === 'request-confirmation'
  const confirmationStatus = result.confirmationStatus
  const isConfirmed = confirmationStatus && confirmationStatus !== 'pending-confirmation'
  const isComplete = result.isComplete

  // Simplified workflow for both lab and instant tests
  const baseSteps = [
    {
      label: 'Collected',
      icon: Circle,
      completed: true, // If we have the record, it was collected
    },
    {
      label: 'Screened',
      icon: FlaskConical,
      completed: !!hasInitialResult,
      current: !hasInitialResult,
    },
  ]

  // Add confirmation steps if positive result and confirmation requested
  if (hasInitialResult && ['expected-positive', 'unexpected-positive'].includes(hasInitialResult)) {
    if (isConfirmationRequested) {
      baseSteps.push(
        {
          label: 'Confirmation Requested',
          icon: FileCheck,
          completed: !!confirmationStatus,
          current: !confirmationStatus,
        },
        {
          label: 'Confirmed',
          icon: CheckCircle,
          completed: !!isConfirmed,
          current: confirmationStatus === 'pending-confirmation',
        }
      )
    } else if (confirmationDecision === 'accept') {
      baseSteps.push({
        label: 'Results Accepted',
        icon: CheckCircle,
        completed: true,
      })
    } else {
      // Awaiting client decision
      baseSteps.push({
        label: 'Awaiting Decision',
        icon: Clock,
        completed: false,
        current: true,
      })
    }
  } else if (hasInitialResult) {
    // Negative or inconclusive - complete
    baseSteps.push({
      label: 'Complete',
      icon: CheckCircle,
      completed: true,
    })
  }

  return baseSteps
}

// Chain of custody component - memoized to prevent unnecessary re-renders
const ChainOfCustody = React.memo(({ result }: { result: DrugTestResult }) => {
  const steps = useMemo(() => generateCustodyChain(result), [result])

  return (
    <div className="flex items-center space-x-2">
      {steps.map((step, index) => {
        const IconComponent = step.icon
        const isCompleted = step.completed
        const isCurrent = step.current && !isCompleted

        return (
          <div key={step.label} className="flex items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                isCompleted
                  ? 'border-green-500 bg-green-500 text-white'
                  : isCurrent
                    ? 'animate-pulse border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 text-gray-400'
              }`}
              title={step.label}
            >
              <IconComponent className="h-3 w-3" />
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-8 ${
                  steps[index + 1].completed ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
})

// Helper function to format test results based on new workflow
function formatTestResult(testData: DrugTestResult): { result: string; substance?: string } {
  const initialResult = testData.initialScreenResult
  const confirmationDecision = testData.confirmationDecision
  const confirmationStatus = testData.confirmationStatus
  const presumptivePositive = testData.presumptivePositive
  const isDilute = testData.isDilute
  const isComplete = testData.isComplete

  if (!initialResult) return { result: 'Pending' }

  let formattedResult: string
  let substance: string | undefined

  // If confirmation was requested and we have confirmation results
  if (confirmationDecision === 'request-confirmation' && confirmationStatus) {
    switch (confirmationStatus) {
      case 'pending-confirmation':
        formattedResult = 'Pending Confirmation'
        break
      case 'confirmed-positive':
        formattedResult = 'Positive'
        break
      case 'confirmed-negative':
        formattedResult = 'Negative'
        break
      case 'confirmation-inconclusive':
        formattedResult = 'Inconclusive'
        break
      default:
        formattedResult = 'Pending Confirmation'
    }
  } else if (confirmationDecision === 'request-confirmation' && !confirmationStatus) {
    formattedResult = 'Pending Confirmation'
  } else {
    // Show initial result (final for negative/inconclusive, or accepted positive)
    switch (initialResult) {
      case 'negative':
        formattedResult = 'Negative'
        break
      case 'expected-positive':
        formattedResult = isComplete ? 'Positive' : 'Presumptive Positive'
        break
      case 'unexpected-positive':
        formattedResult = isComplete ? 'Positive' : 'Presumptive Positive'
        break
      case 'inconclusive':
        formattedResult = 'Inconclusive'
        break
      default:
        formattedResult = 'Unknown'
    }
  }

  // Add substance information for positive results
  if (presumptivePositive && ['expected-positive', 'unexpected-positive'].includes(initialResult)) {
    // Format substance name for display
    const substanceMap: { [key: string]: string } = {
      'amphetamines': 'Amphetamines',
      'methamphetamines': 'Methamphetamines',
      'benzodiazepines': 'Benzodiazepines',
      'thc': 'THC',
      'opiates': 'Opiates',
      'oxycodone': 'Oxycodone',
      'cocaine': 'Cocaine',
      'pcp': 'PCP',
      'barbiturates': 'Barbiturates',
      'methadone': 'Methadone',
      'propoxyphene': 'Propoxyphene',
      'tricyclic_antidepressants': 'Tricyclic Antidepressants',
      'mdma': 'MDMA',
      'buprenorphine': 'Buprenorphine',
      'tramadol': 'Tramadol',
      'fentanyl': 'Fentanyl',
      'kratom': 'Kratom',
      'other': 'Other'
    }
    substance = substanceMap[presumptivePositive] || presumptivePositive
  }

  // Don't add dilute indicator - it has its own column
  return { result: formattedResult, substance }
}

const getResultBadgeVariant = (result: string) => {
  // Color scheme: Red (destructive), Blue (secondary), White (outline)

  // Red - Unexpected positive results
  if (result.includes('Positive') && !result.includes('Expected')) {
    return 'destructive'
  }

  // Blue - Negative results and expected positive
  if (result.includes('Negative') || result.includes('Expected')) {
    return 'secondary'
  }

  // White - Pending, inconclusive, or unknown
  return 'outline'
}

export default function TestResultsPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: testResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['testResults', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/drug-tests?depth=1', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch test results')
      }

      const result = await response.json()
      return result.docs || []
    },
    enabled: !!user && user.collection === 'clients',
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  })

  const data = useMemo(() => {
    if (!testResults || !Array.isArray(testResults)) return []
    return testResults.filter(result => result && typeof result === 'object')
  }, [testResults])

  const columns: ColumnDef<DrugTestResult, any>[] = useMemo(() => [
    {
      accessorKey: 'collectionDate',
      header: 'Date',
      cell: ({ row }) => {
        const collectionDate = row.original.collectionDate
        const createdAt = row.original.createdAt
        const date = new Date(collectionDate || createdAt)
        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
        })
      },
    },
    {
      accessorKey: 'testType',
      header: 'Test Type',
      cell: ({ getValue }) => {
        const testType = getValue()
        switch (testType) {
          case '11-panel-lab':
            return '11-Panel Lab'
          case '15-panel-instant':
            return '15-Panel Instant'
          default:
            return 'Drug Screen'
        }
      },
    },
    {
      id: 'result',
      header: 'Result',
      cell: ({ row }) => {
        const { result, substance } = formatTestResult(row.original)
        return (
          <div className="space-y-1">
            <Badge variant={getResultBadgeVariant(result)}>{result}</Badge>
            {substance && (
              <div className="text-xs text-muted-foreground font-medium">{substance}</div>
            )}
          </div>
        )
      },
    },
    {
      id: 'chain-of-custody',
      header: 'Chain of Custody',
      cell: ({ row }) => {
        return (
          <div className="min-w-[200px]">
            <ChainOfCustody result={row.original} />
          </div>
        )
      },
    },
    {
      id: 'dilute',
      header: 'Dilute',
      cell: ({ row }) => {
        return row.original.isDilute ? (
          <Badge variant="destructive">
            Dilute
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const result = row.original
        const initialResult = result.initialScreenResult
        const confirmationDecision = result.confirmationDecision
        const needsDecision = initialResult &&
          ['expected-positive', 'unexpected-positive'].includes(initialResult) &&
          !confirmationDecision

        return (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (result.testDocument && typeof result.testDocument === 'object' && result.testDocument.url) {
                  window.open(result.testDocument.url, '_blank')
                }
              }}
              disabled={!result.testDocument || typeof result.testDocument !== 'object' || !result.testDocument.url}
              title="View test result"
            >
              <FileText className="h-4 w-4" />
            </Button>
            {needsDecision && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement accept results functionality
                    console.log('Accept results for:', result.id)
                  }}
                  title="Accept results without confirmation"
                >
                  Accept
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement request confirmation functionality
                    console.log('Request confirmation for:', result.id)
                  }}
                  title="Request confirmation testing"
                >
                  Request Confirmation
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ], []) // Empty dependency array since columns are static

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    enableRowSelection: false,
    enableMultiRowSelection: false,
  })

  // Early return if no user or user is not a client
  if (!user || user.collection !== 'clients') {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                Access denied. This page is only available to clients.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
              <p className="text-muted-foreground">Loading your test results...</p>
            </div>
          </div>
        </div>
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
                <p className="text-muted-foreground mt-2 text-sm">Loading test results...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
              <p className="text-muted-foreground">Error loading test results</p>
            </div>
          </div>
        </div>
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                <h2 className="text-lg font-semibold">Error Loading Results</h2>
                <p className="text-muted-foreground">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
            <p className="text-muted-foreground">View and download your drug test results</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Drug Test History</CardTitle>
            <CardDescription>Complete history of your drug screening results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center py-4">
              <Input
                placeholder="Search results..."
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(String(event.target.value))}
                className="max-w-sm"
              />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )} of {table.getFilteredRowModel().rows.length} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Result Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Blue - Negative & Expected Results */}
                <div>
                  <h4 className="font-medium text-sm mb-3 text-blue-700">Blue - Negative & Expected Results</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Negative</Badge>
                      <span className="text-muted-foreground text-sm">No substances detected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Presumptive Positive (Expected)</Badge>
                      <span className="text-muted-foreground text-sm">Expected positive result (prescribed medication)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Positive (Expected)</Badge>
                      <span className="text-muted-foreground text-sm">Final expected positive result</span>
                    </div>
                  </div>
                </div>

                {/* Red - Unexpected Positive & Dilute */}
                <div>
                  <h4 className="font-medium text-sm mb-3 text-red-700">Red - Unexpected Positive & Dilute</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Presumptive Positive</Badge>
                      <span className="text-muted-foreground text-sm">Unexpected positive result (not prescribed)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Positive</Badge>
                      <span className="text-muted-foreground text-sm">Final unexpected positive result</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Dilute</Badge>
                      <span className="text-muted-foreground text-sm">Sample was dilute (shown in separate column)</span>
                    </div>
                  </div>
                </div>

                {/* White - Pending/Inconclusive */}
                <div>
                  <h4 className="font-medium text-sm mb-3 text-gray-700">White - Pending/Inconclusive</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Pending</Badge>
                      <span className="text-muted-foreground text-sm">Awaiting initial results</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Pending Confirmation</Badge>
                      <span className="text-muted-foreground text-sm">Awaiting confirmation testing</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Inconclusive</Badge>
                      <span className="text-muted-foreground text-sm">Unclear result</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain of Custody Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-500 bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-muted-foreground text-sm">Completed step</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500 text-white">
                    <Clock className="h-3 w-3" />
                  </div>
                  <span className="text-muted-foreground text-sm">Current step (in progress)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 text-gray-400">
                    <Circle className="h-3 w-3" />
                  </div>
                  <span className="text-muted-foreground text-sm">Pending step</span>
                </div>
                <div className="mt-4 border-t pt-4">
                  <h4 className="mb-2 text-sm font-medium">Step Icons:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Circle className="h-4 w-4" />
                      <span>Collected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4" />
                      <span>Shipped</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FlaskConical className="h-4 w-4" />
                      <span>Screened</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileCheck className="h-4 w-4" />
                      <span>Confirmation</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}