'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { guidedWorkflowApi } from '../workflows/complete-workflow/guided-workflow-api'
import { ReportPreparationLayout } from './ReportPreparationLayout'

export function ReportPreparation({
  clientId,
  hasReport,
  children,
}: {
  clientId: string
  hasReport: boolean
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const started = useRef<string | null>(null)
  const queryKey = ['guided', 'redwood-provisioning', clientId, '17-panel-instant']
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: ({ signal }) => guidedWorkflowApi.getRedwoodStatus(clientId, '17-panel-instant', signal),
    enabled: Boolean(clientId),
    retry: false,
    staleTime: 1_000,
    refetchInterval: (query) =>
      query.state.status !== 'error' && (!query.state.data || query.state.data.overallStatus === 'working')
        ? 1_000
        : false,
  })
  useEffect(() => {
    if (!clientId || started.current === clientId) return
    started.current = clientId
    void guidedWorkflowApi
      .ensureRedwood({ clientId, testTypeValue: '17-panel-instant' })
      .then(() => queryClient.invalidateQueries({ queryKey: ['guided', 'redwood-provisioning', clientId] }))
      .catch(() => queryClient.invalidateQueries({ queryKey: ['guided', 'redwood-provisioning', clientId] }))
  }, [clientId, queryClient])
  return (
    <ReportPreparationLayout
      status={status}
      isLoading={isLoading}
      isError={isError}
      nextTitle="2. Upload the saved PDF"
      reportComplete={hasReport}
      reportStatus={hasReport ? 'PDF uploaded' : 'Waiting for PDF'}
    >
      {children}
    </ReportPreparationLayout>
  )
}
