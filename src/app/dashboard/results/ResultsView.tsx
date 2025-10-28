'use client'

import React, { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, X, Filter } from 'lucide-react'
import { DrugTest } from '@/payload-types'
import { CheckCircle, Circle, Clock, Truck, FlaskConical, FileCheck } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangePicker } from '@/components/date-range-picker'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { type DateRange } from 'react-day-picker'

type DrugTestResult = DrugTest

// Chain of custody step interface
interface CustodyStep {
  label: string
  icon: React.ComponentType<{ className?: string }>
  completed: boolean
  current?: boolean
}

// Generate chain of custody steps based on test data
function generateCustodyChain(result: DrugTestResult): CustodyStep[] {
  // Use screeningStatus for accurate workflow tracking
  const screeningStatus = result.screeningStatus || (result.initialScreenResult ? 'screened' : 'collected')
  const hasInitialResult = !!result.initialScreenResult
  const confirmationDecision = result.confirmationDecision
  const isConfirmationRequested = confirmationDecision === 'request-confirmation'
  const confirmationResults = result.confirmationResults
  const confirmationSubstances = result.confirmationSubstances || []
  const isConfirmed = Array.isArray(confirmationResults) &&
    confirmationResults.length === confirmationSubstances.length &&
    confirmationResults.every((r: any) => r.result)
  const isComplete = result.isComplete
  const testType = result.testType
  const is15Panel = testType === '15-panel-instant'
  const is11PanelLab = testType === '11-panel-lab'
  const is17PanelLab = testType === '17-panel-sos-lab'
  const isEtgLab = testType === 'etg-lab'
  const isLabTest = is11PanelLab || is17PanelLab || isEtgLab

  // Determine if screening is complete
  const isScreened = screeningStatus === 'screened' || screeningStatus === 'confirmation-pending' || screeningStatus === 'complete'

  // If test is marked as complete, show all steps as complete
  if (isComplete) {
    const completeSteps: CustodyStep[] = [
      {
        label: 'Collected',
        icon: Circle,
        completed: true,
      },
    ]

    // Add shipping for lab tests before screening
    if (isLabTest) {
      completeSteps.push({
        label: 'Shipped',
        icon: Truck,
        completed: true,
      })
    }

    completeSteps.push({
      label: 'Screened',
      icon: FlaskConical,
      completed: true,
    })

    // Add shipping for 15-panel instant before complete (if confirmation exists)
    if (is15Panel && confirmationResults && confirmationResults.length > 0) {
      completeSteps.push({
        label: 'Shipped',
        icon: Truck,
        completed: true,
      })
    }

    completeSteps.push({
      label: 'Complete',
      icon: CheckCircle,
      completed: true,
    })

    return completeSteps
  }

  // Build steps based on test type and current state
  const steps: CustodyStep[] = [
    {
      label: 'Collected',
      icon: Circle,
      completed: true, // If we have the record, it was collected
    },
  ]

  // For lab tests, add shipping BEFORE screening
  if (isLabTest) {
    steps.push({
      label: 'Shipped',
      icon: Truck,
      completed: isScreened, // Shipped if screened (results are back)
      current: screeningStatus === 'collected', // Current if waiting for lab results
    })
  }

  steps.push({
    label: 'Screened',
    icon: FlaskConical,
    completed: isScreened,
    current: screeningStatus === 'collected' && !isLabTest, // Current only for instant tests that need screening
  })

  // Add confirmation steps if unexpected results
  const hasUnexpectedResults = result.initialScreenResult &&
    ['unexpected-positive', 'unexpected-negative', 'mixed-unexpected'].includes(result.initialScreenResult)

  if (hasUnexpectedResults) {
    if (isConfirmationRequested) {
      // For 15-panel instant with confirmation, add shipping before confirmation
      if (is15Panel) {
        steps.push({
          label: 'Shipped',
          icon: Truck,
          completed: !!isConfirmed,
          current: !isConfirmed,
        })
      }

      steps.push(
        {
          label: 'Confirmation Requested',
          icon: FileCheck,
          completed: !!isConfirmed,
          current: false,
        },
        {
          label: 'Confirmed',
          icon: CheckCircle,
          completed: !!isConfirmed,
          current: Array.isArray(confirmationResults) && confirmationResults.length > 0 && !isConfirmed,
        },
      )
    } else if (confirmationDecision === 'accept') {
      steps.push({
        label: 'Results Accepted',
        icon: CheckCircle,
        completed: true,
      })
    } else {
      // Awaiting client decision
      steps.push({
        label: 'Awaiting Decision',
        icon: Clock,
        completed: false,
        current: true,
      })
    }
  } else if (hasInitialResult) {
    // Negative or inconclusive - complete
    steps.push({
      label: 'Complete',
      icon: CheckCircle,
      completed: true,
    })
  }

  return steps
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

ChainOfCustody.displayName = 'ChainOfCustody'

// Helper function to format test results based on new workflow
function formatTestResult(testData: DrugTestResult): {
  result: string;
  unexpectedPositives?: string[];
  unexpectedNegatives?: string[];
  confirmationResults?: Array<{ substance: string; result: string; notes?: string }>;
} {
  const initialResult = testData.initialScreenResult
  const confirmationDecision = testData.confirmationDecision
  const confirmationResults = testData.confirmationResults
  const unexpectedPositives = testData.unexpectedPositives
  const unexpectedNegatives = testData.unexpectedNegatives
  const isComplete = testData.isComplete

  if (!initialResult) return { result: 'Pending' }

  let formattedResult: string

  // Substance map for display
  const substanceMap: { [key: string]: string } = {
    '6-mam': 'Heroin',
    amphetamines: 'Amphetamines',
    methamphetamines: 'Methamphetamines',
    benzodiazepines: 'Benzodiazepines',
    thc: 'THC',
    opiates: 'Opiates',
    oxycodone: 'Oxycodone',
    cocaine: 'Cocaine',
    pcp: 'PCP',
    barbiturates: 'Barbiturates',
    methadone: 'Methadone',
    propoxyphene: 'Propoxyphene',
    tricyclic_antidepressants: 'Tricyclic Antidepressants',
    mdma: 'MDMA (Ecstasy)',
    buprenorphine: 'Buprenorphine',
    tramadol: 'Tramadol',
    fentanyl: 'Fentanyl',
    kratom: 'Kratom',
    etg: 'EtG (Alcohol)',
    synthetic_cannabinoids: 'Synthetic Cannabinoids',
    other: 'Other',
  }

  // Check if confirmation was requested and completed
  const confirmationSubstances = testData.confirmationSubstances || []
  const hasAllConfirmationResults = confirmationDecision === 'request-confirmation' &&
    Array.isArray(confirmationResults) &&
    confirmationResults.length === confirmationSubstances.length &&
    confirmationResults.every((r: any) => r.result)

  // If confirmation is pending, show pending status
  if (confirmationDecision === 'request-confirmation' && !hasAllConfirmationResults) {
    formattedResult = 'Pending Confirmation'
  } else if (hasAllConfirmationResults) {
    // Confirmation is complete - merge confirmed results with original results
    // Show initial result status (will show confirmed results in substance badges)
    switch (initialResult) {
      case 'negative':
        formattedResult = 'Negative'
        break
      case 'expected-positive':
        formattedResult = 'Expected Positive'
        break
      case 'unexpected-positive':
        formattedResult = 'Confirmed Results'
        break
      case 'unexpected-negative':
        formattedResult = 'Confirmed Results'
        break
      case 'mixed-unexpected':
        formattedResult = 'Confirmed Results'
        break
      case 'inconclusive':
        formattedResult = 'Inconclusive'
        break
      default:
        formattedResult = 'Unknown'
    }
  } else {
    // No confirmation requested - show initial result
    switch (initialResult) {
      case 'negative':
        formattedResult = 'Negative'
        break
      case 'expected-positive':
        formattedResult = 'Expected Positive'
        break
      case 'unexpected-positive':
        formattedResult = isComplete ? 'Positive' : 'Presumptive Positive'
        break
      case 'unexpected-negative':
        formattedResult = isComplete ? 'Negative (Unexpected)' : 'Presumptive Negative (Unexpected)'
        break
      case 'mixed-unexpected':
        formattedResult = isComplete ? 'Mixed Results' : 'Presumptive Mixed Results'
        break
      case 'inconclusive':
        formattedResult = 'Inconclusive'
        break
      default:
        formattedResult = 'Unknown'
    }
  }

  // Merge confirmation results with original results
  // If confirmation is complete, override confirmed substances, keep others from original
  let finalUnexpectedPositives = unexpectedPositives
  let finalUnexpectedNegatives = unexpectedNegatives

  if (hasAllConfirmationResults) {
    // Create a map of confirmed substances to their results
    const confirmedMap = new Map<string, string>()
    confirmationResults.forEach((conf: any) => {
      confirmedMap.set(conf.substance, conf.result)
    })

    // Filter out confirmed substances from unexpectedPositives/negatives
    // Only keep substances that were NOT confirmed (weren't contested)
    finalUnexpectedPositives = unexpectedPositives?.filter(
      sub => !confirmationSubstances.includes(sub)
    )
    finalUnexpectedNegatives = unexpectedNegatives?.filter(
      sub => !confirmationSubstances.includes(sub)
    )
  }

  // Format substances for display
  const formattedUnexpectedPositives = Array.isArray(finalUnexpectedPositives) && finalUnexpectedPositives.length > 0
    ? finalUnexpectedPositives.map(sub => substanceMap[sub] || sub)
    : undefined

  const formattedUnexpectedNegatives = Array.isArray(finalUnexpectedNegatives) && finalUnexpectedNegatives.length > 0
    ? finalUnexpectedNegatives.map(sub => substanceMap[sub] || sub)
    : undefined

  return {
    result: formattedResult,
    unexpectedPositives: formattedUnexpectedPositives,
    unexpectedNegatives: formattedUnexpectedNegatives,
    confirmationResults: hasAllConfirmationResults ? (confirmationResults as any) : undefined,
  }
}

const getResultBadgeVariant = (result: string) => {
  // Color scheme: Red (destructive), Yellow (warning), Blue (secondary), White (outline)

  // Blue - PASS results (Negative, Expected Positive, and Confirmed Negative)
  if (result === 'Negative' || result === 'Expected Positive' || result === 'Confirmed Negative') {
    return 'secondary'
  }

  // Confirmed Results - neutral color (will show detail in badges below)
  if (result === 'Confirmed Results') {
    return 'outline'
  }

  // Yellow - Unexpected negatives (missed medications)
  if (result.includes('Negative (Unexpected)')) {
    return 'warning'
  }

  // Red - Any unexpected positives, mixed results
  if (result.includes('Positive') || result.includes('Mixed')) {
    return 'destructive'
  }

  // White - Pending, inconclusive, or unknown
  return 'outline'
}

interface ResultsViewProps {
  testResults: DrugTestResult[]
  contactPhone?: string
}

export function ResultsView({ testResults, contactPhone }: ResultsViewProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [resultFilter, setResultFilter] = useState<string>('')
  const [testTypeFilter, setTestTypeFilter] = useState<string>('')
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)

  // Custom filter functions
  const filteredData = useMemo(() => {
    if (!testResults || !Array.isArray(testResults)) return []

    let filtered = testResults.filter((result) => result && typeof result === 'object')

    // Apply date filter
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((result) => {
        const resultDate = new Date(result.collectionDate || result.createdAt)
        // Reset time to start of day for accurate comparison
        const resultDateOnly = new Date(resultDate.getFullYear(), resultDate.getMonth(), resultDate.getDate())

        if (dateRange.from) {
          const fromDateOnly = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate())
          if (resultDateOnly < fromDateOnly) return false
        }

        if (dateRange.to) {
          const toDateOnly = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate())
          if (resultDateOnly > toDateOnly) return false
        }

        return true
      })
    }

    // Apply result filter
    if (resultFilter && resultFilter !== 'all') {
      filtered = filtered.filter((result) => {
        const { result: formattedResult } = formatTestResult(result)

        switch (resultFilter) {
          case 'negative':
            return formattedResult.toLowerCase().includes('negative')
          case 'positive-expected':
            return formattedResult.toLowerCase().includes('positive') && formattedResult.toLowerCase().includes('expected')
          case 'positive-unexpected':
            return formattedResult.toLowerCase().includes('positive') && !formattedResult.toLowerCase().includes('expected')
          case 'pending':
            return formattedResult.toLowerCase().includes('pending')
          case 'inconclusive':
            return formattedResult.toLowerCase().includes('inconclusive')
          default:
            return true
        }
      })
    }

    // Apply test type filter
    if (testTypeFilter && testTypeFilter !== 'all') {
      filtered = filtered.filter((result) => result.testType === testTypeFilter)
    }

    return filtered
  }, [testResults, dateRange, resultFilter, testTypeFilter])

  const columns: ColumnDef<DrugTestResult, any>[] = useMemo(
    () => [
      {
        accessorKey: 'collectionDate',
        header: 'Date',
        size: 100,
        cell: ({ row }) => {
          const collectionDate = row.original.collectionDate
          const createdAt = row.original.createdAt
          const date = new Date(collectionDate || createdAt)
          return (
            <div className="whitespace-nowrap text-sm">
              {date.toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: '2-digit',
              })}
            </div>
          )
        },
      },
      {
        accessorKey: 'testType',
        header: 'Test Type',
        size: 120,
        cell: ({ getValue }) => {
          const testType = getValue()
          let label = 'Drug Screen'
          switch (testType) {
            case '11-panel-lab':
              label = '11-Panel Lab'
              break
            case '15-panel-instant':
              label = '15-Panel Instant'
              break
            case '17-panel-sos-lab':
              label = '17-Panel SOS Lab'
              break
            case 'etg-lab':
              label = 'EtG Lab'
              break
          }
          return <div className="whitespace-nowrap text-sm">{label}</div>
        },
      },
      {
        id: 'result',
        header: 'Result',
        size: 200,
        cell: ({ row }) => {
          const { result, unexpectedPositives, unexpectedNegatives, confirmationResults } = formatTestResult(row.original)

          // Substance map for display - full names
          const substanceMap: { [key: string]: string } = {
            '6-mam': '6-MAM (Heroin)',
            amphetamines: 'Amphetamines',
            methamphetamines: 'Methamphetamines',
            benzodiazepines: 'Benzodiazepines',
            thc: 'THC',
            opiates: 'Opiates',
            oxycodone: 'Oxycodone',
            cocaine: 'Cocaine',
            pcp: 'PCP',
            barbiturates: 'Barbiturates',
            methadone: 'Methadone',
            propoxyphene: 'Propoxyphene',
            tricyclic_antidepressants: 'Tricyclic Antidepressants',
            mdma: 'MDMA (Ecstasy)',
            buprenorphine: 'Buprenorphine',
            tramadol: 'Tramadol',
            fentanyl: 'Fentanyl',
            kratom: 'Kratom',
            etg: 'EtG (Alcohol)',
            synthetic_cannabinoids: 'Synthetic Cannabinoids',
            other: 'Other',
          }

          return (
            <div className="space-y-2 py-2">
              <Badge variant={getResultBadgeVariant(result)} className="font-medium">
                {result}
              </Badge>
              {/* Show confirmation results FIRST */}
              {confirmationResults && confirmationResults.length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                    Confirmed:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {confirmationResults.map((conf: any, idx: number) => {
                      const substanceName = substanceMap[conf.substance] || conf.substance
                      const variant = conf.result === 'confirmed-positive' ? 'destructive' :
                                     conf.result === 'confirmed-negative' ? 'secondary' : 'outline'
                      const symbol = conf.result === 'confirmed-positive' ? ' (Positive)' :
                                    conf.result === 'confirmed-negative' ? ' (Negative)' : ' (Inconclusive)'
                      return (
                        <Badge key={idx} variant={variant} className="text-[10px] px-1.5 py-0">
                          {substanceName}{symbol}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Then show presumptive results that weren't confirmed */}
              {unexpectedPositives && unexpectedPositives.length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                    Unexpected Positive:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unexpectedPositives.map((substance, idx) => (
                      <Badge key={idx} variant="destructive" className="text-[10px] px-1.5 py-0">
                        {substance}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {unexpectedNegatives && unexpectedNegatives.length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                    Unexpected Negative:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unexpectedNegatives.map((substance, idx) => (
                      <Badge key={idx} variant="warning" className="text-[10px] px-1.5 py-0">
                        {substance}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'chain-of-custody',
        header: 'Status',
        size: 240,
        cell: ({ row }) => {
          return (
            <div className="min-w-[200px] py-1">
              <ChainOfCustody result={row.original} />
            </div>
          )
        },
      },
      {
        id: 'dilute',
        header: 'Dilute',
        size: 80,
        cell: ({ row }) => {
          return row.original.isDilute ? (
            <Badge variant="destructive" className="text-xs">Dilute</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 100,
        cell: ({ row }) => {
          const result = row.original
          const initialResult = result.initialScreenResult
          const confirmationDecision = result.confirmationDecision
          const needsDecision =
            initialResult &&
            ['unexpected-positive', 'mixed-unexpected'].includes(initialResult) &&
            !confirmationDecision

          // Prefer confirmation document if it exists (includes both initial and final results)
          const documentToView =
            result.confirmationDocument &&
            typeof result.confirmationDocument === 'object' &&
            result.confirmationDocument.url
              ? result.confirmationDocument
              : result.testDocument &&
                  typeof result.testDocument === 'object' &&
                  result.testDocument.url
                ? result.testDocument
                : null

          return (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (documentToView?.url) {
                    window.open(documentToView.url, '_blank')
                  }
                }}
                disabled={!documentToView}
                title="View test result"
                className="h-8 px-2"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">View</span>
              </Button>
              {needsDecision && (
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <p className="font-semibold">Confirmation Available</p>
                  <p>You have 30 days to request confirmation testing.</p>
                  {contactPhone ? (
                    <a
                      href={`tel:${contactPhone.replace(/\D/g, '')}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Call {contactPhone} to request
                    </a>
                  ) : (
                    <p>Please call us to request confirmation.</p>
                  )}
                </div>
              )}
            </div>
          )
        },
      },
    ],
    [contactPhone],
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    enableRowSelection: false,
    enableMultiRowSelection: false,
  })

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
            {/* Enhanced Filtering Interface */}
            <div className="py-4">
              {/* Desktop Filters */}
              <div className="hidden md:block space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Date Range Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Date Range:</span>
                    <DateRangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      placeholder="Select date range"
                      className="w-[240px]"
                    />
                  </div>

                  {/* Result Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Result:</span>
                    <Select value={resultFilter} onValueChange={setResultFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All results" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Results</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                        <SelectItem value="positive-expected">Positive (Expected)</SelectItem>
                        <SelectItem value="positive-unexpected">Positive (Unexpected)</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="inconclusive">Inconclusive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Test Type Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Test Type:</span>
                    <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="11-panel-lab">11-Panel Lab</SelectItem>
                        <SelectItem value="15-panel-instant">15-Panel Instant</SelectItem>
                        <SelectItem value="17-panel-sos-lab">17-Panel SOS Lab</SelectItem>
                        <SelectItem value="etg-lab">EtG Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(dateRange?.from || dateRange?.to || resultFilter || testTypeFilter) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRange(undefined)
                        setResultFilter('')
                        setTestTypeFilter('')
                      }}
                      className="ml-2"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Quick filters:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const today = new Date()
                      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                      setDateRange({ from: sevenDaysAgo, to: today })
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const today = new Date()
                      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                      setDateRange({ from: thirtyDaysAgo, to: today })
                    }}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const today = new Date()
                      const sixMonthsAgo = new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
                      setDateRange({ from: sixMonthsAgo, to: today })
                    }}
                  >
                    Last 6 months
                  </Button>
                </div>
              </div>

              {/* Mobile Filter Drawer */}
              <div className="md:hidden">
                <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {(dateRange?.from || dateRange?.to || resultFilter || testTypeFilter) && (
                        <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Filter Results</DrawerTitle>
                      <DrawerDescription>
                        Refine your test results by date, result type, or test type.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-6">
                      {/* Date Range Filter */}
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Date Range</span>
                        <DateRangePicker
                          value={dateRange}
                          onChange={setDateRange}
                          placeholder="Select date range"
                          className="w-full"
                        />
                      </div>

                      {/* Quick Date Presets */}
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Quick Presets</span>
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const today = new Date()
                              const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                              setDateRange({ from: sevenDaysAgo, to: today })
                            }}
                            className="justify-start"
                          >
                            Last 7 days
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const today = new Date()
                              const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                              setDateRange({ from: thirtyDaysAgo, to: today })
                            }}
                            className="justify-start"
                          >
                            Last 30 days
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const today = new Date()
                              const sixMonthsAgo = new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
                              setDateRange({ from: sixMonthsAgo, to: today })
                            }}
                            className="justify-start"
                          >
                            Last 6 months
                          </Button>
                        </div>
                      </div>

                      {/* Result Status Filter */}
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Result Status</span>
                        <Select value={resultFilter} onValueChange={setResultFilter}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All results" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Results</SelectItem>
                            <SelectItem value="negative">Negative</SelectItem>
                            <SelectItem value="positive-expected">Positive (Expected)</SelectItem>
                            <SelectItem value="positive-unexpected">Positive (Unexpected)</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="inconclusive">Inconclusive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Test Type Filter */}
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Test Type</span>
                        <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="11-panel-lab">11-Panel Lab</SelectItem>
                            <SelectItem value="15-panel-instant">15-Panel Instant</SelectItem>
                            <SelectItem value="17-panel-sos-lab">17-Panel SOS Lab</SelectItem>
                            <SelectItem value="etg-lab">EtG Lab</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Clear Filters Button */}
                      {(dateRange?.from || dateRange?.to || resultFilter || testTypeFilter) && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setDateRange(undefined)
                            setResultFilter('')
                            setTestTypeFilter('')
                            setIsFilterDrawerOpen(false)
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/50">
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} className="font-semibold text-xs uppercase tracking-wide">
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
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        className="border-b last:border-b-0 hover:bg-muted/30"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 align-top">
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
              <div className="text-muted-foreground text-sm">
                Showing{' '}
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{' '}
                to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  filteredData.length,
                )}{' '}
                of {filteredData.length} results
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
                {/* Green - PASS Results */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-green-700">
                    Green - PASS Results
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Negative</Badge>
                      <span className="text-muted-foreground text-sm">
                        All substances negative as expected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Expected Positive</Badge>
                      <span className="text-muted-foreground text-sm">
                        Only prescribed medications detected
                      </span>
                    </div>
                  </div>
                </div>

                {/* Red - Unexpected Positive Results */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-red-700">
                    Red - Unexpected Positive Results & Issues
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Presumptive Positive</Badge>
                      <span className="text-muted-foreground text-sm">
                        Substance detected that was not expected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Positive</Badge>
                      <span className="text-muted-foreground text-sm">
                        Final confirmed unexpected positive
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Mixed Results</Badge>
                      <span className="text-muted-foreground text-sm">
                        Both unexpected positives and negatives
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">Dilute</Badge>
                      <span className="text-muted-foreground text-sm">
                        Sample was dilute (shown in separate column)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Yellow - Unexpected Negative Results */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-yellow-700">
                    Yellow - Unexpected Negative Results
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="warning">Negative (Unexpected)</Badge>
                      <span className="text-muted-foreground text-sm">
                        Expected substance (medication) not detected
                      </span>
                    </div>
                  </div>
                </div>

                {/* White - Pending/Inconclusive */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-gray-700">
                    White - Pending/Inconclusive
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Pending</Badge>
                      <span className="text-muted-foreground text-sm">
                        Awaiting initial results
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Pending Confirmation</Badge>
                      <span className="text-muted-foreground text-sm">
                        Awaiting confirmation testing
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Inconclusive</Badge>
                      <span className="text-muted-foreground text-sm">Unclear result</span>
                    </div>
                  </div>
                </div>

                {/* Substance Badges */}
                <div className="border-t pt-4">
                  <h4 className="mb-3 text-sm font-medium">Substance Labels</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive" className="text-xs">*Substance</Badge>
                      <span className="text-muted-foreground text-sm">
                        Red badges = Unexpected positive substances
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="warning" className="text-xs">*Substance</Badge>
                      <span className="text-muted-foreground text-sm">
                        Yellow badges = Unexpected negative substances (missed medications)
                      </span>
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