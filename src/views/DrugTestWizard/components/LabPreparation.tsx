'use client'

import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import type { GuidedRedwoodProvisioningStatus } from '../workflows/complete-workflow/actions'
import { ReportPreparationLayout } from './ReportPreparationLayout'

export function LabPreparation({
  status,
  isLoading,
  testCode,
  donorName,
  reportCreated,
  onReportCreatedChange,
  isPending,
  continueButton,
}: {
  status?: GuidedRedwoodProvisioningStatus
  isLoading: boolean
  testCode: string
  donorName: string
  reportCreated: boolean
  onReportCreatedChange: (checked: boolean) => void
  isPending: boolean
  continueButton: ReactNode
}) {
  return (
    <ReportPreparationLayout
      status={status}
      isLoading={isLoading}
      generationDetails={
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Donor name</dt>
          <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{donorName}</dd>
          <dt className="text-muted-foreground">Test code</dt>
          <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{testCode}</dd>
        </dl>
      }
      nextTitle="2. Continue here"
      reportComplete={reportCreated}
      reportStatus={reportCreated ? 'Report created' : 'Create report before continuing'}
    >
      <div className="flex items-start gap-3 text-sm font-medium">
        <Checkbox
          id="lab-report-created"
          checked={reportCreated}
          onCheckedChange={(checked) => onReportCreatedChange(checked === true)}
          disabled={isPending}
          className="mt-0.5 shrink-0"
        />
        <label htmlFor="lab-report-created" className="cursor-pointer">
          I created the report in ToxAccess
        </label>
      </div>
      <p className="text-muted-foreground text-sm">No PDF upload needed for this lab collection.</p>
      {continueButton}
    </ReportPreparationLayout>
  )
}
