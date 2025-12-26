'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { collectLabFormOpts } from '../shared-form'
import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { sdk } from '@/lib/payload-sdk'
import { Client } from '@/payload-types'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { MedicationList } from '../../../components/medications/MedicationList'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const getClientMedications = async (clientId: string): Promise<Client['medications']> => {
  const client = await sdk.findByID({
    collection: 'clients',
    id: clientId,
  })
  return client.medications || []
}

export const MedicationsGroup = withForm({
  ...collectLabFormOpts,

  props: {
    title: 'Verify Medications',
    description: "Review and update the client's medications for accurate drug test interpretation",
  },

  render: function Render({ form, title, description = '' }) {
    const router = useRouter()
    const client = useStore(form.store, (state) => state.values.client)
    // const [, forceUpdate] = useState(0)

    const {
      data: medications,
      isLoading,
      refetch,
    } = useQuery({
      queryKey: ['medications', client.id],
      queryFn: () => getClientMedications(client.id),
      staleTime: Infinity,
      enabled: !!client.id,
    })

    const handleRefresh = async () => {
      const result = await refetch()
      if (result.data) {
        // Force the form to overwrite current edits with fresh server data
        form.setFieldValue('medications', result.data)
      }
    }

    // Only initialize medications if form doesn't already have them
    useEffect(() => {
      const formMeds = form.getFieldValue('medications')
      const formIsEmpty = !formMeds || formMeds.length === 0
      if (formIsEmpty && medications && medications.length > 0) {
        form.setFieldValue('medications', medications)
      }
    }, [medications, form])

    if (!client) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No client selected. Please go back and select a client.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <FieldGroupHeader title={title} description={description} />

        {/* Client Info Card */}
        <div className="bg-card border-border w-full rounded-xl border p-6 shadow-md">
          {/* Client Info */}
          <div className="flex items-start gap-8">
            <Avatar className="size-24 shrink-0">
              <AvatarImage
                src={client.headshot ?? undefined}
                alt={`${client.firstName} ${client.lastName}`}
              />
              <AvatarFallback className="text-lg">
                {client.firstName?.charAt(0)}
                {client.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <p className="text-foreground text-2xl font-semibold">
                {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
                {client.lastName}
              </p>
              <div>
                <p className="text-muted-foreground text-lg">{client.email}</p>
                {client.dob && (
                  <p className="text-muted-foreground text-lg">
                    DOB: {new Date(client.dob).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Medications Section */}
        <Card className="shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between pb-4">
              <div>
                <h3 className="text-2xl font-semibold">Medications</h3>
                <p className="text-muted-foreground text-lg">
                  Manage medications for accurate drug test interpretation
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground p-2 transition-colors"
                title="Refresh medications"
              >
                <RefreshCw className="size-5" />
              </Button>
            </div>

            {isLoading ? (
              <div className="text-muted-foreground py-8 text-center">
                <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
                <p>Loading medications...</p>
              </div>
            ) : (
              <form.AppField name="medications" mode="array">
                {(field) => (
                  <MedicationList
                    medications={field.state.value}
                    onAddMedication={(medication) => {
                      field.pushValue(medication)
                      router.refresh()
                    }}
                    onUpdateMedication={(index, updatedMedication) => {
                      const newMedications = [...field.state.value]
                      newMedications[index] = updatedMedication
                      field.handleChange(newMedications)
                      router.refresh()
                    }}
                  />
                )}
              </form.AppField>
            )}
          </CardContent>
        </Card>
      </div>
    )
  },
})
