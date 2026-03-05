'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, User, FileText, AlertTriangle, Pill } from 'lucide-react'
import { getLabScreenFormOpts } from '../../shared-form'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'
import { useConfirmLogic } from './useConfirmLogic'
import { ClientInfoContent } from '../../../components/client/ClientDisplayCard'
import {
  BreathalyzerDisplay,
  ClassificationAlert,
} from '../../../instant-test/steps/confirm/components'

export const ConfirmStep = withForm({
  ...getLabScreenFormOpts('confirm'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const { client, matchedTest, labScreenData, medications, preview, filenames } = useConfirmLogic(formValues)

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
            {/* 1. Client Info */}
            <SummarySection icon={User} title="Client">
              {client ? (
                <ClientInfoContent client={client} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading client information...</p>
              )}
            </SummarySection>

            {/* 2. Test Type */}
            <SummarySection icon={FileText} title="Test Type">
              <p className="text-lg font-medium">{labScreenData?.testType}</p>
            </SummarySection>

            {/* 3. Collection Date */}
            <SummarySection icon={FileText} title="Collection Date">
              <p className="font-medium">
                {labScreenData?.collectionDate ? new Date(labScreenData.collectionDate).toLocaleString() : 'Not set'}
              </p>
            </SummarySection>

            {/* 4. Sample Status */}
            {labScreenData?.isDilute && (
              <SummarySection icon={AlertTriangle} title="Sample Status">
                <Badge variant="outline">Dilute Sample</Badge>
              </SummarySection>
            )}

            {/* 5. Classification */}
            <SummarySection icon={FileText} title="Classification">
              <ClassificationAlert preview={preview} />
            </SummarySection>

            {/* 6. Breathalyzer (from matched test if available) */}
            {matchedTest?.breathalyzerTaken && (
              <SummarySection icon={AlertTriangle} title="Breathalyzer">
                <BreathalyzerDisplay result={matchedTest.breathalyzerResult} />
              </SummarySection>
            )}

            {/* 7. Medications (from matched test) */}
            {medications && medications.length > 0 && (
              <SummarySection icon={Pill} title="Client Medications">
                <div className="space-y-2">
                  {medications.map((med: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{med.medicationName}</span>
                      {med.detectedAs && med.detectedAs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {med.detectedAs.filter((s: string) => s !== 'none').map((substance: string) => (
                            <Badge key={substance} variant="secondary" className="text-[10px]">
                              {substance}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SummarySection>
            )}

            {/* 8. Filenames */}
            <SummarySection icon={FileText} title="PDF Document">
              <div className="font-mono text-sm">
                <div className="flex flex-col gap-1">
                  <div>
                    <span className="text-muted-foreground text-xs">Original:</span> {filenames.original}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">New:</span> {filenames.new}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Size:</span> {filenames.size}
                  </div>
                </div>
              </div>
            </SummarySection>
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
