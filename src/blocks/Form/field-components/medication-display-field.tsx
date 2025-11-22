'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Medication {
  name: string
  detectedAs: string[]
}

interface MedicationDisplayFieldProps {
  medications: Medication[]
  title?: string
  description?: string
}

export default function MedicationDisplayField({
  medications,
  title = 'Active Medications',
  description = 'Expected to test positive for the following substances',
}: MedicationDisplayFieldProps) {
  if (medications.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wide text-amber-900 dark:text-amber-100">
          {title}
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-300">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <ul className="space-y-2">
          {medications.map((med, i) => (
            <li key={i} className="text-sm text-amber-900 dark:text-amber-100">
              <div className="font-medium">
                • {med.name}
                {med.detectedAs.length > 0 && (
                  <span className="capitalize"> ({med.detectedAs.join(', ')})</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
