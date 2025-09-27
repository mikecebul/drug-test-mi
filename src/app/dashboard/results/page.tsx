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
import { Download, FileText, Eye } from "lucide-react"

type DrugTestResult = {
  id: string
  date: string
  type: string
  result: "Negative" | "Expected Positive" | "Unexpected Positive" | "Dilute" | "Invalid"
  substances: string[]
  observer: string
  status: "Verified" | "Under Review" | "Pending"
  mroNote?: string
  documentUrl?: string
  collectionTime: string
  labName: string
  certificationNumber: string
}

const mockData: DrugTestResult[] = [
  {
    id: "1",
    date: "2025-09-20",
    type: "10-Panel Urine",
    result: "Negative",
    substances: [],
    observer: "M. Smith",
    status: "Verified",
    collectionTime: "10:30 AM",
    labName: "Quest Diagnostics",
    certificationNumber: "QD-2025-0920-001",
    documentUrl: "/documents/test-result-1.pdf"
  },
  {
    id: "2",
    date: "2025-09-13",
    type: "10-Panel Urine",
    result: "Expected Positive",
    substances: ["Amphetamine"],
    observer: "M. Smith",
    status: "Verified",
    mroNote: "Consistent with Adderall prescription",
    collectionTime: "2:15 PM",
    labName: "Quest Diagnostics",
    certificationNumber: "QD-2025-0913-002",
    documentUrl: "/documents/test-result-2.pdf"
  },
  {
    id: "3",
    date: "2025-09-06",
    type: "10-Panel Urine",
    result: "Negative",
    substances: [],
    observer: "J. Wilson",
    status: "Verified",
    collectionTime: "11:45 AM",
    labName: "LabCorp",
    certificationNumber: "LC-2025-0906-001",
    documentUrl: "/documents/test-result-3.pdf"
  },
  {
    id: "4",
    date: "2025-08-30",
    type: "5-Panel Urine",
    result: "Unexpected Positive",
    substances: ["THC"],
    observer: "M. Smith",
    status: "Under Review",
    mroNote: "No prescription on file for THC",
    collectionTime: "9:00 AM",
    labName: "Quest Diagnostics",
    certificationNumber: "QD-2025-0830-003"
  },
  {
    id: "5",
    date: "2025-08-23",
    type: "10-Panel Urine",
    result: "Expected Positive",
    substances: ["Benzodiazepine"],
    observer: "M. Smith",
    status: "Verified",
    mroNote: "Consistent with Xanax prescription",
    collectionTime: "3:30 PM",
    labName: "LabCorp",
    certificationNumber: "LC-2025-0823-002",
    documentUrl: "/documents/test-result-5.pdf"
  }
]

const columnHelper = createColumnHelper<DrugTestResult>()

const getResultBadgeVariant = (result: DrugTestResult["result"]) => {
  switch (result) {
    case "Negative":
      return "default"
    case "Expected Positive":
      return "secondary"
    case "Unexpected Positive":
      return "destructive"
    case "Dilute":
      return "outline"
    case "Invalid":
      return "outline"
    default:
      return "outline"
  }
}

const getStatusBadgeVariant = (status: DrugTestResult["status"]) => {
  switch (status) {
    case "Verified":
      return "default"
    case "Under Review":
      return "secondary"
    case "Pending":
      return "outline"
    default:
      return "outline"
  }
}

export default function TestResultsPage() {
  const [data, setData] = useState<DrugTestResult[]>(mockData)
  const [globalFilter, setGlobalFilter] = useState("")

  const columns: ColumnDef<DrugTestResult, any>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => {
        const date = new Date(getValue())
        return date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric"
        })
      },
    },
    {
      accessorKey: "type",
      header: "Test Type",
    },
    {
      accessorKey: "result",
      header: "Result",
      cell: ({ getValue }) => {
        const result = getValue()
        return (
          <Badge variant={getResultBadgeVariant(result)}>
            {result}
          </Badge>
        )
      },
    },
    {
      accessorKey: "substances",
      header: "Substances",
      cell: ({ getValue }) => {
        const substances = getValue() as string[]
        return substances.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {substances.map((substance, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {substance}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">None detected</span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue()
        return (
          <Badge variant={getStatusBadgeVariant(status)}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "observer",
      header: "Observer",
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
                // TODO: Implement view details
                console.log("View details for", result.id)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {result.documentUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // TODO: Implement download
                  console.log("Download", result.documentUrl)
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <Badge variant="outline">Dilute/Invalid</Badge>
                <span className="text-sm text-muted-foreground">Test issue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}