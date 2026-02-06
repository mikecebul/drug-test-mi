'use client'

import { sdk } from '@/lib/payload-sdk'

export interface SimpleClient {
  id: string
  firstName: string
  middleInitial?: string
  lastName: string
  fullName?: string
  initials: string
  email: string
  dob?: string
  headshot?: string
  headshotId?: string
  matchType?: 'exact' | 'fuzzy'
  score?: number
  phone?: string
}

export async function getClients(): Promise<SimpleClient[]> {
  const { docs: clientsResult } = await sdk.find({
    collection: 'clients',
    limit: 1000,
    sort: 'lastName',
    depth: 2, // Populate headshot relation
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleInitial: true,
      email: true,
      dob: true,
      headshot: true,
    },
  })
  const clients = clientsResult.map((client): SimpleClient => {
    // Prefer thumbnail for performance, fallback to full image
    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    const headshotId =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.id
        : undefined

    return {
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName: client.middleInitial
        ? `${client.firstName} ${client.middleInitial} ${client.lastName}`
        : `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      headshot,
      headshotId,
    }
  })
  return clients
}

export async function getClientById(id: string): Promise<SimpleClient | null> {
  try {
    const client = await sdk.findByID({
      collection: 'clients',
      id,
      depth: 2,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleInitial: true,
        email: true,
        dob: true,
        headshot: true,
        phone: true,
      },
    })

    if (!client) return null

    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    const headshotId =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.id
        : undefined

    return {
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName: client.middleInitial
        ? `${client.firstName} ${client.middleInitial} ${client.lastName}`
        : `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      phone: client.phone ?? undefined,
      headshot,
      headshotId,
    }
  } catch (err) {
    // Payload throws if not found
    return null
  }
}

/**
 * Fetch client from a drug test ID
 * This is useful in workflows where you're updating an existing test and need the client info
 */
export async function getClientFromTestId(testId: string): Promise<SimpleClient | null> {
  try {
    // Fetch the drug test with the related client
    const drugTest = await sdk.findByID({
      collection: 'drug-tests',
      id: testId,
      depth: 2, // Depth 2 needed to populate relatedClient and headshot
      select: {
        relatedClient: true,
      },
    })

    if (!drugTest || !drugTest.relatedClient) return null

    // Type guard to check if relatedClient is an object
    const client = typeof drugTest.relatedClient === 'object' ? drugTest.relatedClient : null
    if (!client) return null

    // Extract headshot URL (prefer thumbnail for performance)
    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    const headshotId =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.id
        : undefined

    return {
      id: client.id,
      firstName: client.firstName,
      middleInitial: client.middleInitial ?? undefined,
      lastName: client.lastName,
      fullName: client.middleInitial
        ? `${client.firstName} ${client.middleInitial} ${client.lastName}`
        : `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      email: client.email,
      dob: client.dob ?? undefined,
      phone: client.phone ?? undefined,
      headshot,
      headshotId,
    }
  } catch (err) {
    console.error('Error fetching client from test:', err)
    return null
  }
}

export interface DrugTestWithMedications {
  id: string
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string | null | undefined
  screeningStatus: 'collected' | 'screened' | 'confirmation-pending' | 'complete'
  medicationsArrayAtTestTime: any[]
  relatedClient: any
  breathalyzerTaken: boolean
  breathalyzerResult: number | null
}

/**
 * Fetch drug test with medications snapshot
 * Returns the drug test with medicationsAtTestTime for displaying the medications
 * that were active when the test was collected
 */
export async function getDrugTestWithMedications(testId: string): Promise<DrugTestWithMedications | null> {
  try {
    const drugTest = await sdk.findByID({
      collection: 'drug-tests',
      id: testId,
      depth: 2,
      select: {
        id: true,
        testType: true,
        collectionDate: true,
        screeningStatus: true,
        medicationsArrayAtTestTime: true,
        relatedClient: true,
        breathalyzerTaken: true,
        breathalyzerResult: true,
      },
    })

    if (!drugTest) return null

    return {
      id: drugTest.id,
      testType: drugTest.testType,
      collectionDate: drugTest.collectionDate,
      screeningStatus: drugTest.screeningStatus,
      medicationsArrayAtTestTime: drugTest.medicationsArrayAtTestTime || [],
      relatedClient: drugTest.relatedClient,
      breathalyzerTaken: drugTest.breathalyzerTaken || false,
      breathalyzerResult: drugTest.breathalyzerResult || null,
    }
  } catch (err) {
    console.error('Error fetching drug test with medications:', err)
    return null
  }
}
