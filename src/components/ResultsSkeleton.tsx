import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header Section */}
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="flex items-center py-4">
              <Skeleton className="h-9 w-64" />
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {/* Date */}
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      {/* Test Type */}
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      {/* Result */}
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </TableCell>
                      {/* Chain of Custody */}
                      <TableCell>
                        <div className="flex items-center space-x-2 min-w-[200px]">
                          {Array.from({ length: 4 }).map((_, j) => (
                            <div key={j} className="flex items-center">
                              <Skeleton className="h-6 w-6 rounded-full" />
                              {j < 3 && <Skeleton className="mx-1 h-0.5 w-8" />}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      {/* Dilute */}
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      {/* Actions */}
                      <TableCell>
                        <div className="flex space-x-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-16 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-4">
              <Skeleton className="h-4 w-48" />
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-20 rounded" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend Cards */}
      <div className="px-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Result Legend Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-48 mb-3" />
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="flex items-center space-x-2">
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-4 w-64" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chain of Custody Legend Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
                <div className="mt-4 border-t pt-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
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