'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

export async function addMedicationAction(data: {
  medicationName: string
  startDate: Date
  status?: 'active' | 'discontinued'
  detectedAs?: string
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Use PayloadCMS's built-in auth to verify the session
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      throw new Error('Unauthorized - must be logged in as a client')
    }

    // Get the current client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: user.id,
    })

    const currentMedications = clientRecord.medications || []

    // Create the new medication entry with createdAt timestamp
    const newMedication = {
      medicationName: data.medicationName,
      startDate: data.startDate.toISOString(),
      status: data.status || 'active',
      ...(data.detectedAs && { detectedAs: data.detectedAs }),
      createdAt: new Date().toISOString(), // This will work with the local API
    }

    // Update the client with the new medication using local API (bypasses access controls)
    await payload.update({
      collection: 'clients',
      id: user.id,
      data: {
        medications: [...currentMedications, newMedication],
      },
      overrideAccess: true, // This bypasses access controls
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

export async function updateMedicationAction(data: {
  medicationIndex: number
  status: 'active' | 'discontinued'
  endDate?: string | Date
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Use PayloadCMS's built-in auth to verify the session
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      throw new Error('Unauthorized - must be logged in as a client')
    }

    // Get the current client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: user.id,
    })

    const currentMedications = clientRecord.medications || []

    if (data.medicationIndex < 0 || data.medicationIndex >= currentMedications.length) {
      throw new Error('Invalid medication index')
    }

    // Update the specific medication
    const updatedMedications = [...currentMedications]
    const originalMedication = updatedMedications[data.medicationIndex]

    // Prevent changes to discontinued medications
    if (originalMedication.status === 'discontinued') {
      throw new Error('Discontinued medications cannot be modified to preserve history integrity')
    }

    const updatedMedication = {
      ...originalMedication,
      status: data.status,
    }

    // Handle endDate for discontinued medications
    if (data.status === 'discontinued' && data.endDate) {
      try {
        if (typeof data.endDate === 'string') {
          const trimmedDate = data.endDate.trim()
          if (trimmedDate) {
            updatedMedication.endDate = trimmedDate
          }
        } else {
          // data.endDate is a Date object
          updatedMedication.endDate = data.endDate.toISOString()
        }
      } catch (dateError) {
        throw new Error('Invalid end date format')
      }
    } else if (data.status !== 'discontinued') {
      // Remove endDate if status is not discontinued
      delete updatedMedication.endDate
    }

    updatedMedications[data.medicationIndex] = updatedMedication

    // Update the client using local API (bypasses access controls)
    await payload.update({
      collection: 'clients',
      id: user.id,
      data: {
        medications: updatedMedications,
      },
      overrideAccess: true, // This bypasses access controls
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

export async function deleteMedicationAction(data: {
  medicationIndex: number
}) {
  const payload = await getPayload({ config: configPromise })

  try {
    // Use PayloadCMS's built-in auth to verify the session
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      throw new Error('Unauthorized - must be logged in as a client')
    }

    // Get the current client record
    const clientRecord = await payload.findByID({
      collection: 'clients',
      id: user.id,
    })

    const currentMedications = clientRecord.medications || []

    if (data.medicationIndex < 0 || data.medicationIndex >= currentMedications.length) {
      throw new Error('Invalid medication index')
    }

    const medicationToDelete = currentMedications[data.medicationIndex]

    // Prevent deletion of discontinued medications to preserve history
    if (medicationToDelete.status === 'discontinued') {
      throw new Error('Discontinued medications cannot be deleted to preserve history integrity')
    }

    // Remove the medication at the specified index
    const updatedMedications = currentMedications.filter((_, index) => index !== data.medicationIndex)

    // Update the client using local API (bypasses access controls)
    await payload.update({
      collection: 'clients',
      id: user.id,
      data: {
        medications: updatedMedications,
      },
      overrideAccess: true, // This bypasses access controls
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