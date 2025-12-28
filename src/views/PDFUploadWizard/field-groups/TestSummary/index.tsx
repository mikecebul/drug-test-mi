'use client'

import React from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, User, FileText, AlertTriangle } from 'lucide-react'
import { z } from 'zod'
import type { PdfUploadFormType } from '../../schemas/pdfUploadSchemas'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { wizardContainerStyles } from '../../styles'
import { cn } from '@/utilities/cn'
import { useConfirmFieldLogic } from './useConfirmFieldLogic'
import { ClientInfoCard } from '../../components/ClientInfoCard'
import { ClassificationAlert } from './ClassificationAlert'
import { BreathalyzerDisplay } from './BreathalyzerDisplay'

// Export the schema for reuse in step validation
export const testSummaryFieldSchema = z.object({
  previewComputed: z.boolean(),
})

const defaultValues: PdfUploadFormType['testSummary'] = {
  previewComputed: false,
}

export const TestSummaryFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Confirm and Create',
    description: '',
  },

  render: function Render({ group, title, description = '' }) {
    const { client, verifyData, extractData, preview, isLoading, filenames } =
      useConfirmFieldLogic(group)

    return (
      <div className={wizardContainerStyles.content}>
        <FieldGroupHeader title={title} description={description} />
        <Card className="border-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" /> Test Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            {/* 1. Client Info */}
            <SummarySection icon={User} title="Client">
              <ClientInfoCard variant="ghost" client={client} />
            </SummarySection>

            {/* 2. Test Details */}
            <SummarySection icon={FileText} title="Test Type">
              <p className="text-lg font-medium">{verifyData?.testType}</p>
            </SummarySection>

            {/* 3. Classification (The complex part now simplified) */}
            <SummarySection icon={FileText} title="Classification">
              {isLoading ? <p>...Loading</p> : <ClassificationAlert preview={preview} />}
            </SummarySection>

            {/* 4. Breathalyzer */}
            {verifyData?.breathalyzerTaken && (
              <SummarySection icon={AlertTriangle} title="Breathalyzer">
                <BreathalyzerDisplay result={verifyData.breathalyzerResult} />
              </SummarySection>
            )}

            {/* 5. Filenames */}
            <SummarySection icon={FileText} title="PDF Document">
              <div className="font-mono text-sm">
                <span className="text-xs opacity-60">Original:</span> {filenames.original} <br />
                <span className="text-xs opacity-60">New:</span> {filenames.new}
                <span className="text-xs opacity-60">Size:</span> {filenames.size}
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
