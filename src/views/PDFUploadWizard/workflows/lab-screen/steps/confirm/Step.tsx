'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, User, FileText } from 'lucide-react'
import { getLabScreenFormOpts } from '../../shared-form'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'

export const ConfirmStep = withForm({
  ...getLabScreenFormOpts('confirm'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const { matchCollection, labScreenData } = formValues

    return (
      <div>
        <FieldGroupHeader
          title="Confirm Lab Screening"
          description="Review the final data before updating the test record"
        />

        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" /> Screening Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Matched Test */}
            <SummarySection icon={User} title="Matched Test">
              <p className="font-medium">{matchCollection?.clientName}</p>
              <p className="text-sm text-muted-foreground">{matchCollection?.testType}</p>
            </SummarySection>

            {/* Test Details */}
            <SummarySection icon={FileText} title="Screening Results">
              <p className="text-sm">
                <span className="font-medium">Test Type:</span> {labScreenData?.testType}
              </p>
              <p className="text-sm">
                <span className="font-medium">Collection Date:</span>{' '}
                {labScreenData?.collectionDate ? new Date(labScreenData.collectionDate).toLocaleString() : 'Not set'}
              </p>
              {labScreenData?.isDilute && <Badge variant="outline">Dilute Sample</Badge>}
            </SummarySection>

            {/* Detected Substances */}
            {labScreenData?.detectedSubstances && labScreenData.detectedSubstances.length > 0 && (
              <SummarySection icon={FileText} title="Detected Substances">
                <div className="flex flex-wrap gap-2">
                  {labScreenData.detectedSubstances.map((substance) => (
                    <Badge key={substance} variant="destructive">
                      {formatSubstance(substance)}
                    </Badge>
                  ))}
                </div>
              </SummarySection>
            )}

            {/* Breathalyzer */}
            {labScreenData?.breathalyzerTaken && (
              <SummarySection icon={FileText} title="Breathalyzer">
                <p className="text-sm">BAC: {labScreenData.breathalyzerResult ?? 'N/A'}</p>
              </SummarySection>
            )}
          </CardContent>
        </Card>
      </div>
    )
  },
})

function SummarySection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: any
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1 border-t pt-2', className)}>
      <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="pl-6">{children}</div>
    </div>
  )
}
