'use client'

import { sdk } from '@/lib/payload-sdk'
import { extractPreferredTestType } from '@/lib/quick-book'

type LabTestType = '11-panel-lab' | '11-panel-lab-no-etg' | '17-panel-sos-lab' | 'etg-lab'

const LAB_TEST_TYPES = new Set<string>(['11-panel-lab', '11-panel-lab-no-etg', '17-panel-sos-lab', 'etg-lab'])

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
  updatedAt?: string
  recommendedTestTypeValue?: LabTestType
}

function getReferralPreferredTestType(client: { referral?: unknown }): unknown {
  const referral = client.referral
  if (!referral || typeof referral !== 'object' || !('value' in referral)) {
    return undefined
  }

  const referralValue = referral.value
  if (!referralValue || typeof referralValue !== 'object' || !('preferredTestType' in referralValue)) {
    return undefined
  }

  return referralValue.preferredTestType
}

function toLabTestType(value: unknown): LabTestType | undefined {
  return typeof value === 'string' && LAB_TEST_TYPES.has(value) ? (value as LabTestType) : undefined
}

async function resolveRecommendedLabTestType(client: { referral?: unknown }): Promise<LabTestType | undefined> {
  const extracted = extractPreferredTestType(getReferralPreferredTestType(client))
  const valueFromReferral = toLabTestType(extracted.recommendedTestTypeValue)
  if (valueFromReferral) {
    return valueFromReferral
  }

  if (!extracted.recommendedTestTypeId) {
    return undefined
  }

  try {
    const testType = await sdk.findByID({
      collection: 'test-types',
      id: extracted.recommendedTestTypeId,
      depth: 0,
      select: {
        value: true,
      },
    })

    return toLabTestType(testType?.value)
  } catch (_err) {
    return undefined
  }
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
      phone: true,
      headshot: true,
      referral: true,
      updatedAt: true,
    },
  })
  const clients = await Promise.all(
    clientsResult.map(async (client): Promise<SimpleClient> => {
      // Prefer thumbnail for performance, fallback to full image
      const headshot =
        typeof client.headshot === 'object' && client.headshot
          ? client.headshot.thumbnailURL || client.headshot.url || undefined
          : undefined

      const headshotId = typeof client.headshot === 'object' && client.headshot ? client.headshot.id : undefined

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
        updatedAt: client.updatedAt ?? undefined,
        recommendedTestTypeValue: await resolveRecommendedLabTestType(client),
      }
    }),
  )
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
        referral: true,
        phone: true,
        updatedAt: true,
      },
    })

    if (!client) return null

    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    const headshotId = typeof client.headshot === 'object' && client.headshot ? client.headshot.id : undefined

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
      updatedAt: client.updatedAt ?? undefined,
      recommendedTestTypeValue: await resolveRecommendedLabTestType(client),
    }
  } catch (_err) {
    // Payload throws if not found
    return null
  }
}

export async function getClientByBookingId(bookingId: string): Promise<SimpleClient | null> {
  try {
    const booking = await sdk.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 2,
      select: {
        relatedClient: true,
      },
    })

    const client = typeof booking.relatedClient === 'object' ? booking.relatedClient : null
    if (!client) return null

    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.thumbnailURL || client.headshot.url || undefined
        : undefined

    const headshotId = typeof client.headshot === 'object' && client.headshot ? client.headshot.id : undefined

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
      updatedAt: client.updatedAt ?? undefined,
      recommendedTestTypeValue: await resolveRecommendedLabTestType(client),
    }
  } catch (_err) {
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

    const headshotId = typeof client.headshot === 'object' && client.headshot ? client.headshot.id : undefined

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
      updatedAt: client.updatedAt ?? undefined,
    }
  } catch (err) {
    console.error('Error fetching client from test:', err)
    return null
  }
}

export interface DrugTestWithMedications {
  id: string
  testType:
    | '15-panel-instant'
    | '17-panel-instant'
    | '11-panel-lab'
    | '11-panel-lab-no-etg'
    | '17-panel-sos-lab'
    | 'etg-lab'
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
