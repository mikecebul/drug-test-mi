'use client'

import { useCallback, useEffect } from 'react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HeadshotCaptureCard, MedicationDisplayField, FieldGroupHeader } from '../../components'
import { getLabConfirmationFormOpts } from '../shared-form'
import { ConfirmationResultsEditor } from '../../components/ConfirmationResultsEditor'
import {
  createConfirmationReviewRows,
  getConfirmationRequirements,
  storedConfirmationRows,
} from '../../components/confirmation-review'
import {
  invalidateWizardClientDerivedData,
  useGetClientFromTestQuery,
  useGetDrugTestWithMedicationsQuery,
  useGetDrugTestQuery,
  useExtractPdfQuery,
} from '../../../queries'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'
import { format } from 'date-fns'

export const LabConfirmationDataStep = withForm({
  ...getLabConfirmationFormOpts(),

  render: function Render({ form }) {
    const queryClient = useQueryClient()
    const formValues = useStore(form.store, (state) => state.values)
    const { matchCollection, labConfirmationData, upload } = formValues

    // Fetch client from matched test
    const { data: client } = useGetClientFromTestQuery(matchCollection?.testId)

    // Fetch matched test to get original screening data
    const { data: matchedTest } = useGetDrugTestQuery(matchCollection?.testId)
    // Fetch matched test with medications snapshot for consistent meds rendering
    const { data: matchedTestWithMedications } = useGetDrugTestWithMedicationsQuery(matchCollection?.testId)

    // Get extracted data from query cache (if PDF has confirmation results)
    const { data: extractData } = useExtractPdfQuery(upload.file, 'enter-lab-confirmation')

    // Get medications snapshot from matched test
    const clientMedications: MedicationSnapshot[] =
      matchedTestWithMedications?.medicationsArrayAtTestTime?.map((med: any) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs,
      })) ?? []

    useEffect(() => {
      if (!matchedTest || !extractData || !upload.file) return
      const key = JSON.stringify([upload.file.name, upload.file.size, upload.file.lastModified, matchedTest.id])
      if (form.getFieldValue('labConfirmationData.reviewSourceKey') === key) return
      const requested = matchedTest.confirmationSubstances ?? []
      const rows = createConfirmationReviewRows(
        extractData,
        requested,
        storedConfirmationRows(matchedTest.confirmationResults ?? []),
      )
      form.setFieldValue('labConfirmationData', {
        originalDetectedSubstances: matchedTest.detectedSubstances ?? [],
        originalIsDilute: matchedTest.isDilute ?? false,
        requiredSubstances: [...new Set([...requested, ...getConfirmationRequirements(extractData).substances])],
        reviewSourceKey: key,
        confirmationResults: rows,
      })
    }, [matchedTest, extractData, upload.file, form])

    const handleHeadshotLinked = useCallback(
      (url: string, docId: string) => {
        form.setFieldValue('matchCollection.headshot', url)

        if (!matchCollection?.testId) return

        queryClient.setQueryData(
          ['client-from-test', matchCollection.testId],
          (currentClient: typeof client | null | undefined) => {
            if (!currentClient) return currentClient
            return {
              ...currentClient,
              headshot: url,
              headshotId: docId,
            }
          },
        )

        invalidateWizardClientDerivedData(queryClient, {
          clientId: client?.id,
          testId: matchCollection.testId,
        })
      },
      [client, form, matchCollection?.testId, queryClient],
    )

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Enter Confirmation Results" description="Enter LC-MS/MS confirmation test results" />

        {/* Client Info & Medications */}
        {client && <HeadshotCaptureCard client={client} onHeadshotLinked={handleHeadshotLinked} />}

        {clientMedications.length > 0 && (
          <MedicationDisplayField medicationSnapshot={clientMedications} title="Medications at Collection Time" />
        )}

        {/* Matched Test Context + Original Screening Results */}
        {matchCollection?.testId && (
          <Card className="border-info/30 bg-info/5 transition-all">
            <CardContent className="space-y-5 pt-0">
              <div className="grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                    Collection Date
                  </p>
                  <p className="text-base leading-tight font-medium">
                    {format(new Date(matchCollection.collectionDate), 'PPp')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">Test Type</p>
                  <p className="text-base leading-tight font-medium">{matchCollection.testType}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                  Record Status
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                    Confirmed Match
                  </Badge>
                  {matchCollection.screeningStatus && (
                    <Badge variant="outline">{matchCollection.screeningStatus}</Badge>
                  )}
                </div>
              </div>

              {(labConfirmationData?.originalDetectedSubstances?.length ?? 0) > 0 && (
                <div className="border-border/70 space-y-2.5 border-t pt-4">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                    Original Screening Results
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {labConfirmationData.originalDetectedSubstances.map((substance: string) => (
                      <Badge key={substance} variant="outline">
                        {substance}
                      </Badge>
                    ))}
                    {labConfirmationData.originalIsDilute && <Badge variant="secondary">Dilute Sample</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Original Screening Results (Read-Only) fallback */}
        {!matchCollection?.testId &&
          labConfirmationData?.originalDetectedSubstances &&
          labConfirmationData.originalDetectedSubstances.length > 0 && (
            <Card className="border-muted bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm tracking-wide uppercase">
                  Original Screening Results (Reference)
                </CardTitle>
                <CardDescription className="text-xs">
                  These are the initial screening results - not editable in this workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {labConfirmationData.originalDetectedSubstances.map((substance: string) => (
                    <Badge key={substance} variant="outline">
                      {substance}
                    </Badge>
                  ))}
                  {labConfirmationData.originalIsDilute && <Badge variant="secondary">Dilute Sample</Badge>}
                </div>
              </CardContent>
            </Card>
          )}

        <form.Field name="labConfirmationData.confirmationResults">
          {(field) => (
            <ConfirmationResultsEditor
              rows={field.state.value}
              file={upload.file}
              required={labConfirmationData.requiredSubstances}
              onChange={field.handleChange}
              errors={field.state.meta.errors}
            />
          )}
        </form.Field>
      </div>
    )
  },
})
