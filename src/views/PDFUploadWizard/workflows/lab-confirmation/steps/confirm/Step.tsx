'use client'

import { formatDateOnly } from '@/lib/date-utils'
import { withForm } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, User, FileText, AlertTriangle, XCircle, Pill } from 'lucide-react'
import { getLabConfirmationFormOpts } from '../../shared-form'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/utilities/cn'
import { useConfirmLogic } from './useConfirmLogic'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { FinalStatus } from '@/collections/DrugTests/services/testResults'

export const ConfirmStep = withForm({
  ...getLabConfirmationFormOpts('confirm'),

  render: function Render({ form }) {
    const formValues = useStore(form.store, (state) => state.values)
    const {
      client,
      matchedTest,
      labConfirmationData,
      medications,
      adjustedSubstances,
      preview,
      finalStatus,
      filenames,
    } = useConfirmLogic(formValues)

    const confirmationResults = labConfirmationData?.confirmationResults || []
    const originalSubstances = labConfirmationData?.originalDetectedSubstances || []

    return (
      <div className="space-y-6">
        <FieldGroupHeader
          title="Confirm Confirmation Update"
          description="Review the final data before updating the test record"
        />

        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" /> Confirmation Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Client Info */}
            <SummarySection icon={User} title="Client">
              {client ? (
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={client?.headshot ?? undefined} alt={`${client?.firstName} ${client?.lastName}`} />
                    <AvatarFallback className="text-sm">
                      {client?.firstName?.charAt(0)}
                      {client?.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-lg font-semibold">
                      {client?.firstName} {client?.middleInitial ? `${client.middleInitial}. ` : ''}
                      {client?.lastName}
                    </p>
                    <p className="text-muted-foreground text-sm">{client?.email}</p>
                    {client?.dob && (
                      <p className="text-muted-foreground text-sm">DOB: {formatDateOnly(client.dob)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Loading client information...</p>
              )}
            </SummarySection>

            {/* Original Screening Results */}
            {originalSubstances.length > 0 && (
              <SummarySection icon={FileText} title="Original Screening Results">
                <div className="flex flex-wrap gap-2">
                  {originalSubstances.map((substance: string) => (
                    <Badge key={substance} variant="outline">
                      {substance}
                    </Badge>
                  ))}
                  {labConfirmationData?.originalIsDilute && <Badge variant="secondary">Dilute Sample</Badge>}
                </div>
              </SummarySection>
            )}

            {/* Confirmation Results */}
            {confirmationResults.length > 0 && (
              <SummarySection icon={FileText} title="Confirmation Results (LC-MS/MS)">
                <div className="space-y-2">
                  {confirmationResults.map((result: any, index: number) => {
                    const resultConfig = {
                      'confirmed-positive': {
                        variant: 'destructive' as const,
                        icon: XCircle,
                        label: 'Confirmed Positive',
                        className: '',
                      },
                      'confirmed-negative': {
                        variant: 'outline' as const,
                        icon: CheckCircle2,
                        label: 'Confirmed Negative',
                        className:
                          'border-green-600 bg-green-100 text-green-900 dark:border-green-400 dark:bg-green-900/30 dark:text-green-100',
                      },
                      inconclusive: {
                        variant: 'secondary' as const,
                        icon: AlertTriangle,
                        label: 'Inconclusive',
                        className: '',
                      },
                    }

                    const config = resultConfig[result.result]
                    const ResultIcon = config.icon

                    return (
                      <div key={index} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.substance}
                          </Badge>
                          <Badge variant={config.variant} className={`gap-1 text-xs ${config.className}`}>
                            <ResultIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                        {result.notes && <span className="text-muted-foreground text-xs">{result.notes}</span>}
                      </div>
                    )
                  })}
                </div>
              </SummarySection>
            )}

            {/* Adjusted Substances */}
            <SummarySection icon={FileText} title="Adjusted Substances (After Confirmation)">
              <p className="text-muted-foreground mb-2 text-xs">
                Substances with confirmed-negatives removed from original screening
              </p>
              <div className="flex flex-wrap gap-2">
                {adjustedSubstances.length > 0 ? (
                  adjustedSubstances.map((substance: string) => (
                    <Badge key={substance} variant="default">
                      {substance}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">All Negative</Badge>
                )}
              </div>
            </SummarySection>

            {/* Final Test Result */}
            <SummarySection icon={FileText} title="Final Test Result">
              {finalStatus && <FinalStatusDisplay status={finalStatus} />}
            </SummarySection>

            {/* Breathalyzer */}
            {matchedTest?.breathalyzerTaken && (
              <SummarySection icon={AlertTriangle} title="Breathalyzer">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      matchedTest.breathalyzerResult && matchedTest.breathalyzerResult > 0 ? 'destructive' : 'outline'
                    }
                  >
                    {matchedTest.breathalyzerResult !== null && matchedTest.breathalyzerResult !== undefined
                      ? `${matchedTest.breathalyzerResult.toFixed(3)} BAC`
                      : 'No Result'}
                  </Badge>
                </div>
              </SummarySection>
            )}

            {/* Medications */}
            {medications && medications.length > 0 && (
              <SummarySection icon={Pill} title="Client Medications">
                <div className="space-y-2">
                  {medications.map((med: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{med.medicationName}</span>
                      {med.detectedAs && med.detectedAs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {med.detectedAs
                            .filter((s: string) => s !== 'none')
                            .map((substance: string) => (
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

            {/* Filenames */}
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

// Helper component for sections
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

// Helper component for final status display
function FinalStatusDisplay({ status }: { status: FinalStatus }) {
  const statusConfig: Record<string, any> = {
    negative: {
      variant: 'success',
      title: 'All Negative (Pass)',
      description: 'All confirmation tests came back negative.',
      className: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    },
    'confirmed-negative': {
      variant: 'success',
      title: 'Confirmed Negative (Pass)',
      description: 'All substances confirmed negative.',
      className: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    },
    'expected-positive': {
      variant: 'success',
      title: 'Expected Positive (Pass)',
      description: 'All confirmed substances match prescribed medications.',
      className: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    },
    'unexpected-positive': {
      variant: 'destructive',
      title: 'Unexpected Positive (Fail)',
      description: 'Confirmed substances not in prescribed medications.',
      className: '',
    },
    'unexpected-negative-critical': {
      variant: 'destructive',
      title: 'Unexpected Negative - Critical (Fail)',
      description: 'Missing critical prescribed medications.',
      className: '',
    },
    'unexpected-negative-warning': {
      variant: 'warning',
      title: 'Unexpected Negative - Warning (Pass with Note)',
      description: 'Missing non-critical prescribed medications.',
      className: 'border-warning/50 bg-warning-muted/50',
    },
    'mixed-unexpected': {
      variant: 'destructive',
      title: 'Mixed Unexpected Results (Fail)',
      description: 'Combination of unexpected positives and negatives.',
      className: '',
    },
    inconclusive: {
      variant: 'warning',
      title: 'Inconclusive',
      description: 'One or more confirmation tests returned inconclusive results.',
      className: 'border-warning/50 bg-warning-muted/50',
    },
  }

  const config = statusConfig[status] || statusConfig['inconclusive']

  return (
    <Alert variant={config.variant as any}>
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>{config.description}</AlertDescription>
    </Alert>
  )
}
