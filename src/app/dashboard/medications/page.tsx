"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Pill,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  History,
} from "lucide-react"

type MedicationStatus = "active" | "discontinued" | "hold"

type Medication = {
  id: string
  medicationName: string
  dosage: string
  prescriber: string
  prescriberPhone?: string
  startDate: string
  endDate?: string
  status: MedicationStatus
  detectedAs?: string
  isVerified: boolean
  lastVerified?: string
  notes?: string
  revisions: MedicationRevision[]
}

type MedicationRevision = {
  id: string
  timestamp: string
  changes: {
    field: string
    oldValue: any
    newValue: any
  }[]
  modifiedBy: string
}

const mockMedications: Medication[] = [
  {
    id: "1",
    medicationName: "Adderall XR",
    dosage: "20mg daily",
    prescriber: "Dr. Michael Chen",
    prescriberPhone: "(555) 123-4567",
    startDate: "2024-01-15",
    status: "active",
    detectedAs: "Amphetamine",
    isVerified: true,
    lastVerified: "2025-09-01",
    notes: "Prescribed for ADHD",
    revisions: [
      {
        id: "r1",
        timestamp: "2025-09-01",
        changes: [
          { field: "lastVerified", oldValue: "2025-08-01", newValue: "2025-09-01" }
        ],
        modifiedBy: "System Verification"
      },
      {
        id: "r2",
        timestamp: "2024-06-15",
        changes: [
          { field: "dosage", oldValue: "15mg daily", newValue: "20mg daily" }
        ],
        modifiedBy: "Dr. Michael Chen"
      }
    ]
  },
  {
    id: "2",
    medicationName: "Xanax",
    dosage: "0.5mg as needed",
    prescriber: "Dr. Sarah Williams",
    prescriberPhone: "(555) 987-6543",
    startDate: "2024-06-10",
    status: "active",
    detectedAs: "Benzodiazepine",
    isVerified: true,
    lastVerified: "2025-09-01",
    notes: "For anxiety management",
    revisions: [
      {
        id: "r3",
        timestamp: "2025-09-01",
        changes: [
          { field: "lastVerified", oldValue: "2025-08-01", newValue: "2025-09-01" }
        ],
        modifiedBy: "System Verification"
      }
    ]
  },
  {
    id: "3",
    medicationName: "Hydrocodone",
    dosage: "5mg every 6 hours",
    prescriber: "Dr. Robert Johnson",
    startDate: "2024-08-20",
    endDate: "2024-09-05",
    status: "discontinued",
    detectedAs: "Opiates",
    isVerified: true,
    lastVerified: "2024-09-05",
    notes: "Post-surgery pain management - completed course",
    revisions: [
      {
        id: "r4",
        timestamp: "2024-09-05",
        changes: [
          { field: "status", oldValue: "active", newValue: "discontinued" },
          { field: "endDate", oldValue: null, newValue: "2024-09-05" }
        ],
        modifiedBy: "Dr. Robert Johnson"
      }
    ]
  }
]

const getStatusBadgeVariant = (status: MedicationStatus) => {
  switch (status) {
    case "active":
      return "default"
    case "discontinued":
      return "secondary"
    case "hold":
      return "outline"
    default:
      return "outline"
  }
}

const getStatusIcon = (status: MedicationStatus) => {
  switch (status) {
    case "active":
      return <CheckCircle className="w-4 h-4" />
    case "discontinued":
      return <Clock className="w-4 h-4" />
    case "hold":
      return <AlertCircle className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

export default function MedicationsPage() {
  const [medications] = useState<Medication[]>(mockMedications)
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Medications</h1>
            <p className="text-muted-foreground">
              Manage your documented medications for drug test verification
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Medication
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Add New Medication</DialogTitle>
                <DialogDescription>
                  Add a new medication to your documented list for drug test verification.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medicationName">Medication Name</Label>
                    <Input id="medicationName" placeholder="e.g., Adderall XR" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input id="dosage" placeholder="e.g., 20mg daily" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prescriber">Prescriber</Label>
                    <Input id="prescriber" placeholder="Dr. John Smith" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prescriberPhone">Prescriber Phone</Label>
                    <Input id="prescriberPhone" placeholder="(555) 123-4567" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detectedAs">Detected As</Label>
                    <Input id="detectedAs" placeholder="e.g., Amphetamine" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Additional notes about this medication..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Medication</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <div className="grid gap-4">
          {medications.map((medication) => (
            <Card key={medication.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Pill className="w-5 h-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-lg">{medication.medicationName}</CardTitle>
                      <CardDescription>{medication.dosage}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusBadgeVariant(medication.status)}>
                      {getStatusIcon(medication.status)}
                      <span className="ml-1 capitalize">{medication.status}</span>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMedication(medication)
                        setShowHistoryDialog(true)
                      }}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Prescriber</p>
                    <p className="font-medium">{medication.prescriber}</p>
                    {medication.prescriberPhone && (
                      <p className="text-xs text-muted-foreground">{medication.prescriberPhone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {new Date(medication.startDate).toLocaleDateString()}
                    </p>
                    {medication.endDate && (
                      <>
                        <p className="text-muted-foreground mt-1">End Date</p>
                        <p className="text-sm">
                          {new Date(medication.endDate).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Detected As</p>
                    <p className="font-medium">
                      {medication.detectedAs || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Verification</p>
                    <div className="flex items-center space-x-1">
                      {medication.isVerified ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="text-sm">
                        {medication.isVerified ? "Verified" : "Pending"}
                      </span>
                    </div>
                    {medication.lastVerified && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last verified: {new Date(medication.lastVerified).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {medication.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm">{medication.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Revision History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Medication History</DialogTitle>
            <DialogDescription>
              {selectedMedication && `Revision history for ${selectedMedication.medicationName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedMedication?.revisions.map((revision) => (
              <div key={revision.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">
                    {new Date(revision.timestamp).toLocaleString()}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {revision.modifiedBy}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {revision.changes.map((change, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium capitalize">{change.field}:</span>
                      <span className="ml-2 text-muted-foreground line-through">
                        {change.oldValue || "empty"}
                      </span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600">
                        {change.newValue || "empty"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <p>
                  <strong>Verification:</strong> All medications are verified with prescribing physicians
                  to ensure accurate drug test interpretation.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <p>
                  <strong>Privacy:</strong> Your medication information is only shared with authorized
                  personnel when required for test result interpretation.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <History className="w-4 h-4 text-purple-500 mt-0.5" />
                <p>
                  <strong>History:</strong> All changes to your medications are tracked with timestamps
                  for compliance and verification purposes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}