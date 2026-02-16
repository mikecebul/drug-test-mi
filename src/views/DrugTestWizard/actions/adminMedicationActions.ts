'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { Medication } from '@/app/dashboard/medications/types'

/**
 * Admin-only medication actions for Drug Test Wizard
 * These actions accept clientId as a parameter and use overrideAccess: true
 * No time-based restrictions (admins have full control)
 */

/**
 * Get all medications for a client (for admin medication management)
 */
export async function getClientMedications(clientId: string) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Verify admin auth
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required')
    }

    // Get the client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: clientId,
    })

    return {
      success: true,
      medications: (clientRecord.medications as Medication[]) || [],
    }
  } catch (error) {
    console.error('Error fetching medications:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch medications',
      medications: [],
    }
  }
}

export async function adminAddMedicationAction(data: {
  clientId: string
  medicationName: string
  detectedAs?: SubstanceValue[]
  requireConfirmation?: boolean
  notes?: string
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Verify admin auth
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required')
    }

    // Get the client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
    })

    const currentMedications = clientRecord.medications || []

    // Create the new medication entry
    const newMedication = {
      medicationName: data.medicationName,
      startDate: new Date().toISOString(),
      status: 'active' as const,
      detectedAs: data.detectedAs || [],
      requireConfirmation: data.requireConfirmation || false,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    }

    // Update the client with the new medication
    await payload.update({
      collection: 'clients',
      id: data.clientId,
      data: {
        medications: [...currentMedications, newMedication],
      },
      overrideAccess: true,
    })

    return {
      success: true,
      medication: newMedication,
      message: 'Medication added successfully',
    }
  } catch (error) {
    console.error('Error adding medication:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add medication',
    }
  }
}

export async function adminUpdateMedicationAction(data: {
  clientId: string
  medicationIndex: number
  medicationName: string
  detectedAs?: SubstanceValue[]
  requireConfirmation?: boolean
  notes?: string
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Verify admin auth
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required')
    }

    // Get the client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
    })

    const currentMedications = clientRecord.medications || []

    if (data.medicationIndex < 0 || data.medicationIndex >= currentMedications.length) {
      throw new Error('Invalid medication index')
    }

    // Update the specific medication (admins can edit any medication, no time restrictions)
    const updatedMedications = [...currentMedications]
    const originalMedication = updatedMedications[data.medicationIndex]

    updatedMedications[data.medicationIndex] = {
      ...originalMedication,
      medicationName: data.medicationName,
      detectedAs: data.detectedAs || [],
      requireConfirmation: data.requireConfirmation || false,
      notes: data.notes || '',
    }

    // Update the client
    await payload.update({
      collection: 'clients',
      id: data.clientId,
      data: {
        medications: updatedMedications,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      medication: updatedMedications[data.medicationIndex],
      message: 'Medication updated successfully',
    }
  } catch (error) {
    console.error('Error updating medication:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update medication',
    }
  }
}

export async function adminToggleMedicationStatusAction(data: {
  clientId: string
  medicationIndex: number
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Verify admin auth
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required')
    }

    // Get the client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
    })

    const currentMedications = clientRecord.medications || []

    if (data.medicationIndex < 0 || data.medicationIndex >= currentMedications.length) {
      throw new Error('Invalid medication index')
    }

    // Mark medication as discontinued (one-way operation)
    const updatedMedications = [...currentMedications]
    const medication = updatedMedications[data.medicationIndex]

    // Only mark as discontinued if currently active
    if (medication.status !== 'active') {
      throw new Error('Medication is already discontinued')
    }

    // Set to discontinued and add endDate
    updatedMedications[data.medicationIndex] = {
      ...medication,
      status: 'discontinued' as const,
      endDate: new Date().toISOString(),
    }

    // Update the client
    await payload.update({
      collection: 'clients',
      id: data.clientId,
      data: {
        medications: updatedMedications,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      medication: updatedMedications[data.medicationIndex],
      message: 'Medication marked as discontinued',
    }
  } catch (error) {
    console.error('Error marking medication as discontinued:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark medication as discontinued',
    }
  }
}

export async function adminDeleteMedicationAction(data: {
  clientId: string
  medicationIndex: number
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Verify admin auth
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required')
    }

    // Get the client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
    })

    const currentMedications = clientRecord.medications || []

    if (data.medicationIndex < 0 || data.medicationIndex >= currentMedications.length) {
      throw new Error('Invalid medication index')
    }

    // Remove the medication at the specified index
    const updatedMedications = currentMedications.filter(
      (_, index) => index !== data.medicationIndex,
    )

    // Update the client
    await payload.update({
      collection: 'clients',
      id: data.clientId,
      data: {
        medications: updatedMedications,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      message: 'Medication deleted successfully',
    }
  } catch (error) {
    console.error('Error deleting medication:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete medication',
    }
  }
}
