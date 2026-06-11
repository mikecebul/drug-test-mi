'use client'

import { useState } from 'react'
import { formatDateOnly } from '@/lib/date-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Pill, CheckCircle, Clock, AlertCircle, Edit, Trash2, Lock } from 'lucide-react'
import { AddMedicationDialog, UpdateMedicationStatusDialog } from './components'
import { EditMedicationDialog } from './components/EditMedicationDialog'
import type { Medication, MedicationStatus } from './types'
import { isMedicationEditable, getMedicationAgeDescription, canUpdateMedicationStatus } from './utils/medicationUtils'
import { toast } from 'sonner'
import { deleteMedicationAction } from './actions'
import { useRouter } from 'next/navigation'

const getStatusBadgeVariant = (status: MedicationStatus) => {
  switch (status) {
    case 'active':
      return 'default'
    case 'discontinued':
      return 'secondary'
    default:
      return 'outline'
  }
}

const getStatusIcon = (status: MedicationStatus) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4" />
    case 'discontinued':
      return <Clock className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

interface MedicationsViewProps {
  medications: Medication[]
}

export function MedicationsView({ medications }: MedicationsViewProps) {
  const router = useRouter()
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null)
  const [selectedMedicationIndex, setSelectedMedicationIndex] = useState<number>(-1)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showEditDetailsDialog, setShowEditDetailsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = async () => {
    if (!selectedMedication || selectedMedicationIndex === -1) return

    try {
      // Use server action to delete medication
      const result = await deleteMedicationAction({
        medicationIndex: selectedMedicationIndex,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete medication')
      }

      router.refresh()
      setShowDeleteDialog(false)
      setSelectedMedication(null)
      setSelectedMedicationIndex(-1)
      toast.success('Medication deleted successfully!')
    } catch (error) {
      console.error('Error deleting medication:', error)
      toast.error(error instanceof Error ? error.message : 'Deleting medication failed. Please try again.')
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-6 lg:px-10 xl:px-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Medications</h1>
            <p className="text-muted-foreground">Manage your reported medications for drug test verification</p>
          </div>
          <AddMedicationDialog />
        </div>
      </div>

      <div className="px-6 lg:px-10 xl:px-12">
        <div className="grid gap-4">
          {medications.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Pill className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">No medications documented</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your current medications to ensure accurate drug test interpretation.
                  </p>
                  <AddMedicationDialog buttonText="Add Your First Medication" />
                </div>
              </CardContent>
            </Card>
          ) : (
            medications.map((medication, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Pill className="h-5 w-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-lg">{medication.medicationName}</CardTitle>
                        <CardDescription>
                          {medication.detectedAs && `Detected as: ${medication.detectedAs}`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(medication.status)}>
                        {getStatusIcon(medication.status)}
                        <span className="ml-1 capitalize">{medication.status}</span>
                      </Badge>
                      {isMedicationEditable(medication) ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMedication(medication)
                              setSelectedMedicationIndex(index)
                              setShowEditDetailsDialog(true)
                            }}
                            title="Edit medication details"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMedication(medication)
                              setSelectedMedicationIndex(index)
                              setShowDeleteDialog(true)
                            }}
                            title="Delete medication"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (medication.status === 'discontinued') {
                              toast.info('Discontinued medications cannot be modified to preserve history integrity')
                            } else {
                              toast.info(
                                <span>
                                  Contact support for changes:{' '}
                                  <a href="tel:+12313736341" className="underline">
                                    (231) 373-6341
                                  </a>{' '}
                                  or{' '}
                                  <a href="mailto:mike@midrugtest.com" className="underline">
                                    mike@midrugtest.com
                                  </a>
                                </span>,
                              )
                            }
                          }}
                          title={
                            medication.status === 'discontinued'
                              ? 'Discontinued medications are locked'
                              : 'Contact support for changes'
                          }
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                      {canUpdateMedicationStatus(medication) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMedication(medication)
                            setSelectedMedicationIndex(index)
                            setShowEditDialog(true)
                          }}
                          title="Update status"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (medication.status === 'discontinued') {
                              toast.info('Discontinued medications cannot have their status changed')
                            } else {
                              toast.info('Status can only be updated within 7 days of adding medication')
                            }
                          }}
                          title={
                            medication.status === 'discontinued' ? 'Status locked' : 'Status update period expired'
                          }
                          className="text-gray-400 hover:text-gray-500"
                          disabled
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {medication.startDate ? formatDateOnly(medication.startDate) : 'Not specified'}
                      </p>
                    </div>
                    {medication.endDate && (
                      <div>
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-medium">{formatDateOnly(medication.endDate)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium capitalize">{medication.status}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Added</p>
                      <p
                        className={`text-xs font-medium ${
                          isMedicationEditable(medication)
                            ? 'text-green-600'
                            : medication.status === 'discontinued'
                              ? 'text-orange-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {getMedicationAgeDescription(medication)}
                        {isMedicationEditable(medication) && <span className="block text-green-600">• Editable</span>}
                        {medication.status === 'discontinued' && (
                          <span className="block text-orange-600">• Locked (Discontinued)</span>
                        )}
                        {!isMedicationEditable(medication) && medication.status !== 'discontinued' && (
                          <span className="text-muted-foreground block">• Contact Support</span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <UpdateMedicationStatusDialog
        showDialog={showEditDialog}
        setShowDialog={setShowEditDialog}
        selectedMedication={selectedMedication}
        setSelectedMedication={setSelectedMedication}
        selectedMedicationIndex={selectedMedicationIndex}
      />

      <EditMedicationDialog
        showDialog={showEditDetailsDialog}
        setShowDialog={setShowEditDetailsDialog}
        selectedMedication={selectedMedication}
        selectedMedicationIndex={selectedMedicationIndex}
      />

      <Drawer direction="right" open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(32rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b px-6 py-5">
            <DrawerTitle className="text-2xl tracking-tight">Delete Medication</DrawerTitle>
            <DrawerDescription>
              {selectedMedication &&
                `Are you sure you want to delete "${selectedMedication.medicationName}"? This action cannot be undone.`}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="border-border mt-0 border-t px-6 py-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete Medication
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="px-6 lg:px-10 xl:px-12">
        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <CheckCircle className="mt-0.5 h-4 w-4 text-green-500" />
                <p>
                  <strong>Accuracy:</strong> Keep your medications up to date to ensure accurate drug test
                  interpretation and avoid false positives.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-blue-500" />
                <p>
                  <strong>Privacy:</strong> Your medication information is only shared with authorized personnel when
                  required for test result interpretation.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Clock className="mt-0.5 h-4 w-4 text-purple-500" />
                <p>
                  <strong>Timeline:</strong> Include start and end dates to help determine if positive results are
                  expected based on your medication schedule.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Edit className="mt-0.5 h-4 w-4 text-green-500" />
                <p>
                  <strong>Editing:</strong> You can edit or delete medications for up to 7 days after adding them. For
                  changes to older medications, contact support:{' '}
                  <a href="tel:+12313736341" className="underline">
                    (231) 373-6341
                  </a>{' '}
                  or{' '}
                  <a href="mailto:mike@midrugtest.com" className="underline">
                    mike@midrugtest.com
                  </a>
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-orange-500" />
                <p>
                  <strong>Discontinuation:</strong> Once a medication is marked as discontinued, it cannot be modified
                  or deleted to preserve history integrity. If you resume taking the same medication later, add it as a
                  new entry.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
