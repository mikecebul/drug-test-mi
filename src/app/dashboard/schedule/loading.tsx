import { TechnicianSelectionSkeleton } from "@/components/TechnicianSelectionSkeleton"

export default function TechniciansLoading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-5 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <TechnicianSelectionSkeleton />
      </div>
    </div>
  )
}