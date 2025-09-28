"use client"

import { useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Download, FileText, Eye, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { PrivateMedia } from "@/payload-types"
import { useQuery } from "@tanstack/react-query"

type DrugTestResult = PrivateMedia

// Helper functions to format test data from Payload
function formatTestResult(
  result: string | null | undefined,
  isDilute?: boolean | null,
  requiresConfirmation?: boolean | null,
  confirmationStatus?: string | null
): string {
  if (!result) return 'Pending'

  let formattedResult: string

  // If confirmation is required, show confirmation status instead of initial result
  if (requiresConfirmation && confirmationStatus) {
    switch (confirmationStatus) {
      case 'pending-confirmation': formattedResult = 'Pending Confirmation'; break
      case 'confirmed-positive': formattedResult = 'Confirmed Positive'; break
      case 'confirmed-negative': formattedResult = 'Confirmed Negative'; break
      case 'confirmation-inconclusive': formattedResult = 'Confirmation Inconclusive'; break
      default: formattedResult = 'Pending Confirmation'
    }
  } else if (requiresConfirmation && !confirmationStatus) {
    formattedResult = 'Pending Confirmation'
  } else {
    // Standard initial result
    switch (result) {
      case 'negative': formattedResult = 'Negative'; break
      case 'expected-positive': formattedResult = 'Expected Positive'; break
      case 'unexpected-positive': formattedResult = 'Unexpected Positive'; break
      case 'pending': formattedResult = 'Pending'; break
      case 'inconclusive': formattedResult = 'Inconclusive'; break
      default: formattedResult = 'Unknown'
    }
  }

  // Add dilute indicator if present
  if (isDilute) {
    formattedResult += ' (Dilute)'
  }

  return formattedResult
}

function formatTestStatus(status: string | null | undefined): string {
  if (!status) return 'Pending'

  switch (status) {
    case 'verified': return 'Verified'
    case 'under-review': return 'Under Review'
    case 'pending-lab': return 'Pending Lab Results'
    case 'requires-followup': return 'Requires Follow-up'
    default: return 'Unknown'
  }
}

const columnHelper = createColumnHelper<DrugTestResult>()

const getResultBadgeVariant = (result: string) => {
  // Handle dilute results
  if (result.includes('(Dilute)')) {
    return "outline"
  }

  // Handle confirmation results
  if (result.includes('Confirmation') || result.includes('Confirmed')) {
    if (result.includes('Positive')) return "destructive"
    if (result.includes('Negative')) return "default"
    return "outline"
  }

  switch (result) {
    case "Negative":
      return "default"
    case "Expected Positive":
      return "secondary"
    case "Unexpected Positive":
      return "destructive"
    case "Pending":
    case "Inconclusive":
      return "outline"
    default:
      return "outline"
  }
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Verified":
      return "default"
    case "Under Review":
    case "Requires Follow-up":
      return "secondary"
    case "Pending Lab Results":
    case "Pending":
      return "outline"
    default:
      return "outline"
  }
}

export default function TestResultsPage() {
  const [globalFilter, setGlobalFilter] = useState("")
  const { user } = useAuth()

  const { data: testResults, isLoading, error } = useQuery({
    queryKey: ['testResults', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/private-media', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch test results')
      }

      const result = await response.json()
      return result.docs?.filter((doc: PrivateMedia) =>
        doc.documentType === 'drug-screen'
      ) || []
    },
    enabled: !!user && user.collection === 'clients',
  })

  const data = testResults || []

  const columns: ColumnDef<DrugTestResult, any>[] = [
    {
      accessorKey: "testDate",
      header: "Date",
      cell: ({ row }) => {
        const testDate = row.original.testDate
        const createdAt = row.original.createdAt
        const date = new Date(testDate || createdAt)
        return date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric"
        })
      },
    },
    {
      accessorKey: "alt",
      header: "Test Type",
      cell: ({ getValue }) => getValue() || "Drug Screen",
    },
    {
      id: "result",
      header: "Result",
      cell: ({ row }) => {
        const result = formatTestResult(
          row.original.testResult,
          row.original.isDilute,
          row.original.requiresConfirmation,
          row.original.confirmationStatus
        )
        return (
          <Badge variant={getResultBadgeVariant(result)}>
            {result}
          </Badge>
        )
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = formatTestStatus(row.original.testStatus)
        return (
          <Badge variant={getStatusBadgeVariant(status)}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ getValue }) => {
        const notes = getValue()
        return notes ? (
          <span className="text-sm">{notes}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const result = row.original
        return (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (result.url) {
                  window.open(result.url, '_blank')
                }
              }}
              disabled={!result.url}
              title="View test result"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

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
  })

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading test results...</p>
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
              <div className="text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
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
            <p className="text-muted-foreground">
              View and download your drug test results
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Drug Test History</CardTitle>
            <CardDescription>
              Complete history of your drug screening results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center py-4">
              <Input
                placeholder="Search results..."
                value={globalFilter ?? ""}
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
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
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
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Result Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Badge variant="default">Negative</Badge>
                <span className="text-sm text-muted-foreground">No substances detected</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">Expected Positive</Badge>
                <span className="text-sm text-muted-foreground">Prescribed medication</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">Unexpected Positive</Badge>
                <span className="text-sm text-muted-foreground">Not prescribed</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Pending Confirmation</Badge>
                <span className="text-sm text-muted-foreground">Awaiting confirmation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="default">Confirmed Negative</Badge>
                <span className="text-sm text-muted-foreground">Lab confirmed negative</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">Confirmed Positive</Badge>
                <span className="text-sm text-muted-foreground">Lab confirmed positive</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">(Dilute)</Badge>
                <span className="text-sm text-muted-foreground">Sample was dilute</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Inconclusive</Badge>
                <span className="text-sm text-muted-foreground">Unclear result</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}