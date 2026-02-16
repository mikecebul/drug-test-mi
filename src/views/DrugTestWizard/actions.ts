'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { extract15PanelInstant } from '@/utilities/extractors/extract15PanelInstant'
import { extractLabTest } from '@/utilities/extractors/extractLabTest'
import type { ParsedPDFData, ClientMatch, WizardType, SimpleClient } from './types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { calculateNameSimilarity, calculateSimilarity } from './utils/calculateSimilarity'
import { computeTestResults, computeFinalStatus, fetchDocument, sendEmails } from '@/collections/DrugTests/services'
import { FormMedications } from './workflows/shared-validators'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'

const _TEST_MODE = process.env.EMAIL_TEST_MODE === 'true'
const _TEST_EMAIL = process.env.EMAIL_TEST_ADDRESS || 'mike@midrugtest.com'

/**
 * Extract data from uploaded PDF file
 */
export async function extractPdfData(
  formData: FormData,
  wizardType?: WizardType,
): Promise<{
  success: boolean
  data?: ParsedPDFData
  error?: string
}> {
  const payload = await getPayload({ config })
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  // Validate file size BEFORE attempting extraction (10MB limit)
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    payload.logger.error({
      msg: 'PDF file too large',
      size: file.size,
      filename: file.name,
      maxSize: MAX_FILE_SIZE,
    })
    return {
      success: false,
      error: `PDF file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB. Please ensure you uploaded the correct file.`,
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // Route to the appropriate parser based on test type
    let extracted: ParsedPDFData

    switch (wizardType) {
      case 'enter-lab-confirmation':
      case 'enter-lab-screen':
        extracted = await extractLabTest(buffer)
        break
      case '15-panel-instant':
      default:
        extracted = await extract15PanelInstant(buffer)
        break
    }

    return { success: true, data: extracted }
  } catch (error) {
    // Log full error context for debugging
    payload.logger.error({
      msg: 'PDF extraction failed',
      error,
      wizardType,
      fileSize: file.size,
      fileName: file.name,
      errorType: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Provide specific error messages based on error type
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('PDF header')) {
      return {
        success: false,
        error: 'This file appears to be corrupt or not a valid PDF. Please check the file and try again.',
      }
    }

    if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
      return {
        success: false,
        error: 'This PDF is password-protected. Please remove the password and try again.',
      }
    }

    return {
      success: false,
      error: `Failed to extract PDF data: ${errorMessage}. Please try a different file or contact support if the problem persists.`,
    }
  }
}

/**
 * Find matching clients using exact match first, then fuzzy search
 */
export async function findMatchingClients(
  firstName: string,
  lastName: string,
  middleInitial?: string,
): Promise<{
  matches: ClientMatch[]
  searchTerm: string
}> {
  const payload = await getPayload({ config })

  const searchTerm = middleInitial ? `${firstName} ${middleInitial} ${lastName}` : `${firstName} ${lastName}`

  // 1. Try exact match first (fastest and most accurate)
  const exactMatch = await payload.find({
    collection: 'clients',
    where: {
      and: [
        { firstName: { equals: firstName } },
        { lastName: { equals: lastName } },
        ...(middleInitial ? [{ middleInitial: { equals: middleInitial } }] : []),
      ],
    },
    limit: 5,
    depth: 1, // Populate headshot relation
  })

  if (exactMatch.docs.length > 0) {
    return {
      matches: exactMatch.docs.map((client) => {
        // Prefer thumbnail for performance, fallback to full image
        const headshot =
          typeof client.headshot === 'object' && client.headshot
            ? client.headshot.sizes?.thumbnail?.url || client.headshot.url || null
            : null
        return {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          middleInitial: client.middleInitial,
          email: client.email,
          dob: client.dob,
          headshot,
          matchType: 'exact' as const,
        }
      }),
      searchTerm,
    }
  }

  // 2. No exact match - use PayloadCMS search collection to find client IDs
  // Query the search collection which has indexed client names
  const searchResults = await payload.find({
    collection: 'search',
    where: {
      'doc.relationTo': { equals: 'clients' },
    },
    depth: 0, // Don't populate - we'll fetch clients manually
    limit: 100,
    overrideAccess: true,
  })

  payload.logger.info(`[findMatchingClients] Search term: "${searchTerm}"`)
  payload.logger.info(`[findMatchingClients] Found ${searchResults.docs.length} search records`)

  // Extract client IDs from search results
  const clientIds = searchResults.docs
    .map((searchDoc) => (typeof searchDoc.doc.value === 'string' ? searchDoc.doc.value : null))
    .filter((id): id is string => id !== null)

  if (clientIds.length === 0) {
    return { matches: [], searchTerm }
  }

  // Fetch all clients in one query
  const clientsResult = await payload.find({
    collection: 'clients',
    where: {
      id: { in: clientIds },
    },
    limit: 100,
    depth: 1, // Populate headshot relation
    overrideAccess: true,
  })

  payload.logger.info(`[findMatchingClients] Fetched ${clientsResult.docs.length} clients`)

  // Calculate similarity scores for each client using weighted name matching
  const scoredMatches = clientsResult.docs
    .map((client) => {
      // Use weighted name similarity (last name 60%, first name 30%, middle 10%)
      const score = calculateNameSimilarity(
        firstName,
        lastName,
        client.firstName,
        client.lastName,
        middleInitial,
        client.middleInitial || undefined,
      )

      // Prefer thumbnail for performance, fallback to full image
      const headshot =
        typeof client.headshot === 'object' && client.headshot
          ? client.headshot.sizes?.thumbnail?.url || client.headshot.url || null
          : null

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        email: client.email,
        dob: client.dob,
        headshot,
        matchType: 'fuzzy' as const,
        score,
      }
    })
    .filter((match) => match.score > 0.5) // Raise threshold to 50% for weighted scoring
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, 10)

  return {
    matches: scoredMatches,
    searchTerm,
  }
}

/**
 * Search for clients by any search term (for manual search)
 */
export async function searchClients(searchTerm: string): Promise<{
  matches: ClientMatch[]
  total: number
}> {
  const payload = await getPayload({ config })

  payload.logger.info(`[searchClients] Searching for: "${searchTerm}"`)

  // Step 1: Query the search collection to get client IDs
  const searchResults = await payload.find({
    collection: 'search',
    where: {
      'doc.relationTo': { equals: 'clients' },
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })

  payload.logger.info(`[searchClients] Found ${searchResults.docs.length} search docs`)

  // Step 2: Extract client IDs from search results
  const clientIds = searchResults.docs
    .map((searchDoc) => (typeof searchDoc.doc.value === 'string' ? searchDoc.doc.value : null))
    .filter((id): id is string => id !== null)

  payload.logger.info(`[searchClients] Extracted ${clientIds.length} client IDs`)

  if (clientIds.length === 0) {
    return { matches: [], total: 0 }
  }

  // Step 3: Fetch full client documents
  const clientsResult = await payload.find({
    collection: 'clients',
    where: {
      id: { in: clientIds },
    },
    limit: 100,
    overrideAccess: true,
  })

  payload.logger.info(`[searchClients] Fetched ${clientsResult.docs.length} clients`)

  // Step 4: Calculate similarity scores for each client
  const scoredMatches = clientsResult.docs
    .map((client) => {
      // For manual search, we need to parse the search term to extract name parts
      const searchParts = searchTerm.trim().split(/\s+/)
      let nameScore = 0

      if (searchParts.length >= 2) {
        // Assume last part is last name, first part is first name
        const searchFirst = searchParts[0]
        const searchLast = searchParts[searchParts.length - 1]
        const searchMiddle = searchParts.length === 3 ? searchParts[1] : undefined

        nameScore = calculateNameSimilarity(
          searchFirst,
          searchLast,
          client.firstName,
          client.lastName,
          searchMiddle,
          client.middleInitial || undefined,
        )
      } else if (searchParts.length === 1) {
        // Single word - check against both first and last name
        const singleTerm = searchParts[0]
        const firstScore = calculateNameSimilarity(singleTerm, '', client.firstName, client.lastName)
        const lastScore = calculateNameSimilarity('', singleTerm, client.firstName, client.lastName)
        nameScore = Math.max(firstScore, lastScore)
      }

      // Also check email similarity
      const emailScore = calculateSimilarity(searchTerm, client.email)

      // Use best match between name and email
      const score = Math.max(emailScore, nameScore)

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        email: client.email,
        dob: client.dob,
        matchType: 'fuzzy' as const,
        score,
      }
    })
    .filter((match) => match.score > 0.5) // Raise threshold to 50% for weighted scoring
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, 10)

  payload.logger.info(`[searchClients] Returning ${scoredMatches.length} matches`)

  return {
    matches: scoredMatches,
    total: scoredMatches.length,
  }
}

/**
 * Get all clients (for dropdown fallback)
 */
export async function getAllClients(): Promise<{
  clients: ClientMatch[]
}> {
  const payload = await getPayload({ config })

  payload.logger.info('[getAllClients] Fetching all clients')

  const clientsResult = await payload.find({
    collection: 'clients',
    limit: 1000,
    sort: 'lastName',
    depth: 1, // Populate headshot relation
    overrideAccess: true,
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      lastName: true,
      email: true,
      dob: true,
      headshot: true,
    },
  })

  payload.logger.info(`[getAllClients] Found ${clientsResult.docs.length} clients`)

  const clients = clientsResult.docs.map((client) => {
    // Prefer thumbnail for performance, fallback to full image
    const headshot =
      typeof client.headshot === 'object' && client.headshot
        ? client.headshot.sizes?.thumbnail?.url || client.headshot.url || null
        : null

    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      middleInitial: client.middleInitial || undefined,
      email: client.email,
      dob: client.dob,
      headshot,
      matchType: 'fuzzy' as const,
      score: 0,
    }
  })

  return { clients }
}

export async function getClients(): Promise<SimpleClient[]> {
  const payload = await getPayload({ config })

  const { docs: clientsResult } = await payload.find({
    collection: 'clients',
    limit: 1000,
    sort: 'lastName',
    depth: 2, // Populate headshot relation
    overrideAccess: true,
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
    }
  })
  return clients
}

/**
 * Get client's active medications for preview
 */
// export async function getClientMedications(
//   clientId: string,
// ): Promise<
//   { success: true; medications: MedicationSnapshot } | { success: false; error: string }
// > {
//   const payload = await getPayload({ config })

//   try {
//     const client = await payload.findByID({
//       collection: 'clients',
//       id: clientId,
//       depth: 0,
//     })

//     if (!client?.medications || !Array.isArray(client.medications)) {
//       return { success: true, medications: [] }
//     }

//     const activeMeds = client.medications
//       .filter((med: any) => med.status === 'active')
//       .map((med: any) => ({
//         name: med.medicationName,
//         detectedAs: (med.detectedAs || []).filter((s: string) => s !== 'none'),
//       }))

//     return { success: true, medications: activeMeds }
//   } catch (error) {
//     payload.logger.error('Error fetching client medications:', error)
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Failed to fetch client medications',
//     }
//   }
// }

/**
 * Compute test result preview for wizard UI
 *
 * Wrapper around the service layer computeTestResults function.
 * Fetches client's current active medications and uses them for preview.
 * Filters expected substances by test type to only check substances this panel actually screens for.
 * This prevents false "unexpected negatives" for substances not tested by the selected panel.
 */
export async function computeTestResultPreview(
  clientId: string,
  detectedSubstances: SubstanceValue[],
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab',
  breathalyzerTaken?: boolean,
  breathalyzerResult?: number | null,
  medications?: MedicationSnapshot[],
): Promise<{
  initialScreenResult:
    | 'negative'
    | 'expected-positive'
    | 'unexpected-positive'
    | 'unexpected-negative-critical'
    | 'unexpected-negative-warning'
    | 'mixed-unexpected'
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  autoAccept: boolean
}> {
  const payload = await getPayload({ config })

  let medicationSnapshot: MedicationSnapshot[]
  // Use provided medications if available, otherwise fetch from database
  if (medications) {
    // Use medications from wizard (may have been modified)
    medicationSnapshot = medications
  } else {
    // Fetch client's current medications for preview
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    // Build medications array from current active medications
    medicationSnapshot =
      client?.medications && Array.isArray(client.medications)
        ? client.medications
            .filter((med: any) => med.status === 'active')
            .map((med: any) => ({
              medicationName: med.medicationName,
              detectedAs: med.detectedAs || [],
            }))
        : []
  }

  return await computeTestResults({
    clientId,
    detectedSubstances,
    medicationsAtTestTime: medicationSnapshot,
    testType, // Wizard filters by test type (only check substances this panel screens for)
    breathalyzerTaken,
    breathalyzerResult,
    payload,
  })
}

/**
 * Create drug test record with admin privileges
 */
export async function createDrugTest(data: {
  clientId: string
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  pdfBuffer: number[]
  pdfFilename: string
  hasConfirmation?: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Validate client exists before proceeding
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted. Please go back and select a different client.',
      }
    }

    // Convert number array back to Buffer for server-side processing
    const buffer = Buffer.from(data.pdfBuffer)

    // 1. Upload PDF to private-media collection
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: data.clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: data.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 2. Prepare drug test data
    const drugTestData: any = {
      relatedClient: data.clientId,
      testType: data.testType,
      collectionDate: data.collectionDate,
      detectedSubstances: data.detectedSubstances,
      isDilute: data.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened', // Mark as screened since we have results
      processNotes: data.hasConfirmation
        ? 'Created via Drug Test Wizard with lab confirmation results'
        : 'Created via Drug Test Wizard',
    }

    // 3. Add confirmation data if present (lab tests)
    if (data.hasConfirmation && data.confirmationResults && data.confirmationResults.length > 0) {
      // Extract substances that need confirmation
      const confirmationSubstances = data.confirmationResults.map((r) => r.substance)

      drugTestData.confirmationDecision = 'request-confirmation'
      drugTestData.confirmationSubstances = confirmationSubstances
      drugTestData.confirmationResults = data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }

    // 4. Create drug test record (computeTestResults hook will run automatically)
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: drugTestData,
      overrideAccess: true,
    })

    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error('Error creating drug test:', error)
    return {
      success: false,
      error: `Failed to create drug test: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get email preview for Step 6 - Review Emails
 */
export async function getEmailPreview(data: {
  clientId: string
  detectedSubstances: SubstanceValue[]
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string
  isDilute: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  medications?: FormMedications
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
    referralTitle: string
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientType: 'probation' | 'employment' | 'self'
    clientHtml: string
    referralHtml: string
    smartGrouping: 'separate' | 'combined'
    clientSubject: string
    referralSubject: string
  }
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch client to determine client type
    const client = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
      depth: 0,
    })

    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const { clientEmail, referralEmails, referralTitle, referralRecipientsDetailed } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload)

    // Compute test result preview (for email content)
    const previewResult = await computeTestResultPreview(
      data.clientId,
      data.detectedSubstances,
      data.testType,
      data.breathalyzerTaken,
      data.breathalyzerResult,
      data.medications, // Pass medications for accurate preview
    )

    // Build email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildScreenedEmail({
      clientName,
      collectionDate: data.collectionDate,
      testType: data.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: data.detectedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: data.isDilute,
      breathalyzerTaken: data.breathalyzerTaken ?? false,
      breathalyzerResult: data.breathalyzerResult ?? null,
      confirmationDecision: data.confirmationDecision,
      clientHeadshotDataUri,
      clientDob,
    })

    // Determine smart grouping based on client type
    const smartGrouping = client.clientType === 'self' ? 'combined' : 'separate'
    const clientType =
      client.clientType === 'probation' || client.clientType === 'employment' || client.clientType === 'self'
        ? client.clientType
        : 'self'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        referralTitle,
        referralRecipientsDetailed,
        clientType,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get email preview for collection notification
 */
export async function getCollectionEmailPreview(data: {
  clientId: string
  testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}): Promise<{
  success: boolean
  data?: {
    referralEmails: string[]
    referralTitle: string
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientType: 'probation' | 'employment' | 'self'
    referralHtml: string
    referralSubject: string
  }
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildCollectedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch client
    const client = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
      depth: 0,
    })

    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const { referralEmails, referralTitle, referralRecipientsDetailed } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload)

    // Build collection email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const dateTimeStr = `${data.collectionDate}`
    const collectionDate = new Date(dateTimeStr).toISOString()

    const emailData = await buildCollectedEmail({
      clientName,
      collectionDate,
      testType: data.testType,
      breathalyzerTaken: data.breathalyzerTaken ?? false,
      breathalyzerResult: data.breathalyzerResult ?? null,
      clientHeadshotDataUri,
      clientDob,
    })

    const clientType =
      client.clientType === 'probation' || client.clientType === 'employment' || client.clientType === 'self'
        ? client.clientType
        : 'self'

    return {
      success: true,
      data: {
        referralEmails,
        referralTitle,
        referralRecipientsDetailed,
        clientType,
        referralHtml: emailData.html,
        referralSubject: emailData.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating collection email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get email preview for confirmation results
 */
export async function getConfirmationEmailPreview(data: {
  clientId: string
  testId: string
  confirmationResults: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
  adjustedSubstances?: SubstanceValue[] // Optional: substances with confirmed negatives removed
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
    referralTitle: string
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientType: 'probation' | 'employment' | 'self'
    clientHtml: string
    referralHtml: string
    smartGrouping: 'separate' | 'combined'
    clientSubject: string
    referralSubject: string
  }
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildCompleteEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch the drug test to get initial screening data
    const drugTest = await payload.findByID({
      collection: 'drug-tests',
      id: data.testId,
      depth: 1,
      overrideAccess: true,
    })

    if (!drugTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const client = typeof drugTest.relatedClient === 'object' ? drugTest.relatedClient : null

    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const { clientEmail, referralEmails, referralTitle, referralRecipientsDetailed } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload)

    // Use adjusted substances if provided (confirmed negatives removed),
    // otherwise fall back to original detected substances
    const substancesForPreview = data.adjustedSubstances ?? (drugTest.detectedSubstances as SubstanceValue[])

    // Compute initial test result for email (need this for complete email template)
    const previewResult = await computeTestResultPreview(data.clientId, substancesForPreview, drugTest.testType)

    // Compute final status using service layer
    const finalStatus = computeFinalStatus({
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      confirmationResults: data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes,
      })),
      breathalyzerTaken: drugTest.breathalyzerTaken || false,
      breathalyzerResult: drugTest.breathalyzerResult ?? null,
    })

    // Build complete email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildCompleteEmail({
      clientName,
      collectionDate: drugTest.collectionDate || '',
      testType: drugTest.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: substancesForPreview,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      confirmationResults: data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes,
      })),
      finalStatus,
      isDilute: drugTest.isDilute || false,
      breathalyzerTaken: drugTest.breathalyzerTaken || false,
      breathalyzerResult: drugTest.breathalyzerResult ?? null,
      clientHeadshotDataUri,
      clientDob,
    })

    // Determine smart grouping based on client type
    const smartGrouping = client.clientType === 'self' ? 'combined' : 'separate'
    const clientType =
      client.clientType === 'probation' || client.clientType === 'employment' || client.clientType === 'self'
        ? client.clientType
        : 'self'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        referralTitle,
        referralRecipientsDetailed,
        clientType,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating confirmation email preview:', error)
    return {
      success: false,
      error: `Failed to generate confirmation email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Create drug test and send approved emails (Step 6 submit)
 */
export async function createDrugTestWithEmailReview(
  testData: {
    clientId: string
    testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
    collectionDate: string
    detectedSubstances: SubstanceValue[]
    isDilute: boolean
    breathalyzerTaken: boolean
    breathalyzerResult: number | null
    pdfBuffer: number[]
    pdfFilename: string
    hasConfirmation?: boolean
    confirmationResults?: Array<{
      substance: SubstanceValue
      result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
      notes?: string
    }>
    confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
    confirmationSubstances?: SubstanceValue[]
  },
  medicationsAtTestTime:
    | Array<{
        medicationName: string
        detectedAs: string[]
        requireConfirmation: boolean
      }>
    | undefined,
  emailConfig: {
    clientEmailEnabled: boolean
    clientRecipients: string[]
    referralEmailEnabled: boolean
    referralRecipients: string[]
  },
): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // === VALIDATION PHASE - Check everything BEFORE creating any resources ===

    // 1. Validate client exists
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted. Please go back and select a different client.',
      }
    }

    // 2. Validate PDF buffer size (max 10MB)
    const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10MB
    const bufferSize = testData.pdfBuffer.length
    if (bufferSize > MAX_PDF_SIZE) {
      payload.logger.error({
        msg: 'PDF buffer too large in createDrugTestWithEmailReview',
        size: bufferSize,
        clientId: testData.clientId,
      })
      return {
        success: false,
        error: `PDF is too large (${(bufferSize / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`,
      }
    }

    // 3. Prepare medications snapshot
    const medicationsSnapshot = medicationsAtTestTime || []
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Using medications snapshot',
      count: medicationsSnapshot.length,
      medications: medicationsSnapshot,
    })

    // 4. Compute test results to validate if confirmation decision is needed
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Computing test results for validation',
      detectedSubstances: testData.detectedSubstances,
      medications: medicationsSnapshot,
    })
    const previewResult = await computeTestResultPreview(
      testData.clientId,
      testData.detectedSubstances,
      testData.testType,
      testData.breathalyzerTaken,
      testData.breathalyzerResult,
      medicationsSnapshot as any,
    )
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Test result classification',
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      autoAccept: previewResult.autoAccept,
    })

    // 5. Validate confirmation decision if unexpected positives detected
    const hasUnexpectedPositives = previewResult.unexpectedPositives.length > 0
    const requiresDecision = hasUnexpectedPositives && !previewResult.autoAccept

    if (requiresDecision && !testData.confirmationDecision) {
      payload.logger.warn({
        msg: 'Confirmation decision missing for unexpected positives',
        clientId: testData.clientId,
        unexpectedPositives: previewResult.unexpectedPositives,
      })
      return {
        success: false,
        error: 'Confirmation decision is required when unexpected positive substances are detected. Please go back and select how to proceed.',
      }
    }

    // === RESOURCE CREATION PHASE - Validation passed, safe to create resources ===

    // Import email functions
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Convert number array back to Buffer
    const buffer = Buffer.from(testData.pdfBuffer)

    // 6. Upload PDF to private-media collection
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: testData.clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: testData.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 3. Prepare drug test data
    const drugTestData: any = {
      relatedClient: testData.clientId,
      testType: testData.testType,
      collectionDate: testData.collectionDate,
      detectedSubstances: testData.detectedSubstances,
      isDilute: testData.isDilute,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      medicationsArrayAtTestTime: medicationsSnapshot, // CRITICAL: Store medications snapshot
      processNotes: testData.hasConfirmation
        ? 'Created via Drug Test Wizard with email review and lab confirmation results'
        : 'Created via Drug Test Wizard with email review',
      sendNotifications: false, // Prevent auto-send
    }

    // 3. Add confirmation data if present (lab tests with embedded confirmation)
    if (testData.hasConfirmation && testData.confirmationResults && testData.confirmationResults.length > 0) {
      const confirmationSubstances = testData.confirmationResults.map((r) => r.substance)

      drugTestData.confirmationDecision = 'request-confirmation'
      drugTestData.confirmationSubstances = confirmationSubstances
      drugTestData.confirmationResults = testData.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }
    // 3b. Add confirmation decision from wizard (for instant tests with unexpected positives)
    else if (testData.confirmationDecision) {
      drugTestData.confirmationDecision = testData.confirmationDecision
      if (
        testData.confirmationDecision === 'request-confirmation' &&
        testData.confirmationSubstances &&
        testData.confirmationSubstances.length > 0
      ) {
        drugTestData.confirmationSubstances = testData.confirmationSubstances
      }
    }

    // 7. Create drug test record with skipNotificationHook context
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: drugTestData,
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // 8. Validate drug test was created successfully
    if (!drugTest || !drugTest.id) {
      payload.logger.error({
        msg: 'Drug test creation returned invalid result',
        clientId: testData.clientId,
        result: drugTest,
      })
      return {
        success: false,
        error: 'Failed to create drug test record - database returned invalid result. Please try again or contact support.',
      }
    }

    payload.logger.info({
      msg: 'Drug test created successfully',
      testId: drugTest.id,
      clientId: testData.clientId,
      testType: testData.testType,
    })

    // 9. Fetch client data for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
    })

    // 10. Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(testData.clientId, payload)

    // 11. Build email content using test results computed during validation
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildScreenedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: testData.detectedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: testData.isDilute,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      confirmationDecision: testData.confirmationDecision,
      clientHeadshotDataUri,
      clientDob,
    })

    // 12. Fetch document and send emails using service layer
    let sentTo: string[] = []
    let failedTo: string[] = []

    try {
      // Fetch document using service layer
      const document = await fetchDocument(uploadedFile.id, payload)

      // Prepare recipient lists based on emailConfig
      const clientRecipients = emailConfig.clientEmailEnabled ? emailConfig.clientRecipients : []
      const referralRecipients = emailConfig.referralEmailEnabled ? emailConfig.referralRecipients : []

      // Combine recipients for service call
      // Service will handle client vs referral distinction
      const allClientRecipients = clientRecipients
      const allReferralRecipients = referralRecipients

      // Send emails using service layer
      const emailResult = await sendEmails({
        payload,
        clientEmail: allClientRecipients.length > 0 ? allClientRecipients[0] : null,
        clientEmailData: allClientRecipients.length > 0 ? emailData.client : null,
        referralEmails: allReferralRecipients,
        referralEmailData: emailData.referrals,
        attachment: {
          filename: document.filename,
          content: document.buffer,
          contentType: document.mimeType,
        },
        emailStage: 'screened',
        drugTestId: drugTest.id,
        clientId: testData.clientId,
        clientName,
      })

      sentTo = emailResult.sentTo
      failedTo = emailResult.failedRecipients
    } catch (documentError) {
      payload.logger.error('Failed to retrieve PDF for email attachment:', documentError)

      // The drug test WAS created successfully, just can't send email with attachment
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created but email cannot be sent - PDF file not found in storage. Please check the file exists and retry sending emails manually.`,
      }
    }

    // 9. Update notification history
    const notificationEntry = {
      stage: 'screened',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients:
        [
          ...emailConfig.clientRecipients.map((e) => `Client: ${e}`),
          ...emailConfig.referralRecipients.map((e) => `Referral: ${e}`),
        ].join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: drugTest.id,
      data: {
        notificationsSent: [notificationEntry],
      },
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // Check for email failures and return appropriate status
    if (failedTo.length > 0 && sentTo.length === 0) {
      // All emails failed
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created but all emails failed to send: ${failedTo.join(', ')}. Please send manually or retry.`,
      }
    } else if (failedTo.length > 0) {
      // Some emails failed - return partial success
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}. Please check and resend failed emails.`,
      }
    }

    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error('Error creating drug test with email review:', error)
    return {
      success: false,
      error: `Failed to create drug test: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Create a collection-only drug test (no screening results yet)
 */
export async function createCollectionOnlyTest(data: {
  clientId: string
  testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string
}): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Create drug test with only collection info
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: data.clientId,
        testType: data.testType,
        collectionDate: data.collectionDate,
        screeningStatus: 'collected', // Status will remain "collected" until results entered
        detectedSubstances: [], // No substances yet
        isDilute: false,
        processNotes: 'Specimen collected - awaiting lab results',
      },
      overrideAccess: true,
    })

    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error('Error creating collection-only test:', error)
    return {
      success: false,
      error: `Failed to create collection record: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Create a collection-only drug test with email review
 */
export async function createCollectionWithEmailReview(
  testData: {
    clientId: string
    testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
    collectionDate: string
    breathalyzerTaken: boolean
    breathalyzerResult: number | null
  },
  emailConfig: {
    referralEmailEnabled: boolean
    referralRecipients: string[]
  },
): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Validate client exists before proceeding
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted. Please go back and select a different client.',
      }
    }

    // Import email functions
    const { buildCollectedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // 1. Create drug test with skipNotificationHook to prevent auto-send
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: testData.clientId,
        testType: testData.testType,
        collectionDate: testData.collectionDate,
        screeningStatus: 'collected',
        detectedSubstances: [],
        isDilute: false,
        breathalyzerTaken: testData.breathalyzerTaken,
        breathalyzerResult: testData.breathalyzerResult,
        processNotes: 'Specimen collected - awaiting lab results (email review)',
      },
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // 2. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
    })

    // 2a. Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(testData.clientId, payload)

    // 3. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildCollectedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      clientHeadshotDataUri,
      clientDob,
    })

    // 4. Send emails using service layer (no attachment for collected stage)
    const referralRecipients = emailConfig.referralEmailEnabled ? emailConfig.referralRecipients : []

    const emailResult = await sendEmails({
      payload,
      clientEmail: null, // Collected stage doesn't send to client
      clientEmailData: null,
      referralEmails: referralRecipients,
      referralEmailData: emailData,
      emailStage: 'collected',
      drugTestId: drugTest.id,
      clientId: testData.clientId,
      clientName,
    })

    const sentTo = emailResult.sentTo
    const failedTo = emailResult.failedRecipients

    // 5. Update notification history
    const notificationEntry = {
      stage: 'collected',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients: emailConfig.referralRecipients.map((e) => `Referral: ${e}`).join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: drugTest.id,
      data: {
        notificationsSent: [notificationEntry],
      },
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // Check for email failures and return appropriate status
    if (failedTo.length > 0 && sentTo.length === 0) {
      // All emails failed
      return {
        success: false,
        testId: drugTest.id,
        error: `Collection recorded but all emails failed to send: ${failedTo.join(', ')}. Please send manually or retry.`,
      }
    } else if (failedTo.length > 0) {
      // Some emails failed - return partial success
      return {
        success: false,
        testId: drugTest.id,
        error: `Collection recorded and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}. Please check and resend failed emails.`,
      }
    }

    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error('Error creating collection with email review:', error)
    return {
      success: false,
      error: `Failed to create collection: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Update an existing test with screening results
 */
export async function updateTestWithScreening(data: {
  testId: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  pdfBuffer: number[]
  pdfFilename: string
  hasConfirmation?: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  confirmationSubstances?: SubstanceValue[]
}): Promise<{
  success: boolean
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // 1. Get existing test to verify it exists and get client ID
    const existingTest = await payload.findByID({
      collection: 'drug-tests',
      id: data.testId,
      overrideAccess: true,
    })

    if (!existingTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const clientId =
      typeof existingTest.relatedClient === 'string' ? existingTest.relatedClient : existingTest.relatedClient.id

    // 2. Upload PDF to private-media
    const buffer = Buffer.from(data.pdfBuffer)
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: data.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 3. Prepare update data
    const updateData: any = {
      detectedSubstances: data.detectedSubstances,
      isDilute: data.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened', // Update status to screened
      processNotes: `${existingTest.processNotes || ''}\nScreening results uploaded via wizard`,
    }

    // 4. Add confirmation data if present (from PDF extraction)
    if (data.hasConfirmation && data.confirmationResults && data.confirmationResults.length > 0) {
      const confirmationSubstances = data.confirmationResults.map((r) => r.substance)
      updateData.confirmationDecision = 'request-confirmation'
      updateData.confirmationSubstances = confirmationSubstances
      updateData.confirmationResults = data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }
    // 4b. Add confirmation decision from wizard (for tests with unexpected positives)
    else if (data.confirmationDecision) {
      updateData.confirmationDecision = data.confirmationDecision
      if (
        data.confirmationDecision === 'request-confirmation' &&
        data.confirmationSubstances &&
        data.confirmationSubstances.length > 0
      ) {
        updateData.confirmationSubstances = data.confirmationSubstances
      }
    }

    // 5. Update the drug test
    await payload.update({
      collection: 'drug-tests',
      id: data.testId,
      data: updateData,
      overrideAccess: true,
    })

    return { success: true }
  } catch (error) {
    payload.logger.error('Error updating test with screening:', error)
    return {
      success: false,
      error: `Failed to update test: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Update an existing test with confirmation results only
 */
export async function updateTestWithConfirmation(data: {
  testId: string
  pdfBuffer: number[]
  pdfFilename: string
  confirmationResults: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}): Promise<{
  success: boolean
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // 1. Get existing test
    const existingTest = await payload.findByID({
      collection: 'drug-tests',
      id: data.testId,
      overrideAccess: true,
    })

    if (!existingTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const clientId =
      typeof existingTest.relatedClient === 'string' ? existingTest.relatedClient : existingTest.relatedClient.id

    // 2. Upload confirmation PDF to private-media (as drug-test-report)
    const buffer = Buffer.from(data.pdfBuffer)
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: data.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 3. Update with confirmation results
    const confirmationSubstances = data.confirmationResults.map((r) => r.substance)

    await payload.update({
      collection: 'drug-tests',
      id: data.testId,
      data: {
        confirmationDocument: uploadedFile.id,
        confirmationDecision: 'request-confirmation',
        confirmationSubstances,
        confirmationResults: data.confirmationResults.map((r) => ({
          substance: r.substance,
          result: r.result,
          notes: r.notes || undefined,
        })),
        screeningStatus: 'complete', // Mark as complete
        processNotes: `${existingTest.processNotes || ''}\nConfirmation results uploaded via wizard`,
      },
      overrideAccess: true,
    })

    return { success: true }
  } catch (error) {
    payload.logger.error('Error updating test with confirmation:', error)
    return {
      success: false,
      error: `Failed to update confirmation: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get client data from a drug test
 * @deprecated Use getClientFromTestId from workflows/components/client/getClients.ts with useGetClientFromTestQuery instead
 * This server action has been replaced with a client-side SDK function for better type safety
 */

/**
 * Fetch pending drug tests
 */
export async function fetchPendingTests(filterStatus?: string[]): Promise<
  | {
      success: true
      tests: {
        id: string
        clientName: string
        testType: string
        collectionDate: string
        screeningStatus: string
        clientHeadshot?: string | null
      }[]
    }
  | { success: false; error: string }
> {
  const payload = await getPayload({ config })

  try {
    // Build where clause based on status filter
    let whereClause: any = {}

    if (filterStatus && filterStatus.length > 0) {
      whereClause = {
        screeningStatus: {
          in: filterStatus,
        },
      }
    } else {
      // Default: only show collected or screened tests (not complete)
      whereClause = {
        screeningStatus: {
          in: ['collected', 'screened', 'confirmation-pending'],
        },
      }
    }

    // Fetch pending drug tests
    const result = await payload.find({
      collection: 'drug-tests',
      where: whereClause,
      sort: '-collectionDate',
      limit: 50,
      depth: 2, // Depth 2 needed to populate relatedClient.headshot
    })

    // Map to simplified format
    return {
      success: true,
      tests: result.docs.map((test) => {
        // Extract client headshot if available
        const client = typeof test.relatedClient === 'object' ? test.relatedClient : null
        const clientHeadshot =
          client && typeof client.headshot === 'object' && client.headshot
            ? client.headshot.sizes?.thumbnail?.url || client.headshot.url || null
            : null

        return {
          id: test.id,
          clientName: test.clientName || 'Unknown',
          testType: test.testType,
          collectionDate: test.collectionDate || '',
          screeningStatus: test.screeningStatus,
          clientHeadshot,
        }
      }),
    }
  } catch (error) {
    payload.logger.error('Error fetching pending tests:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pending tests',
    }
  }
}

/**
 * Generate a secure random password
 * Ensures password meets complexity requirements:
 * - At least 12 characters
 * - Contains uppercase, lowercase, and numbers
 */
function generateSecurePassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Excludes ambiguous: I, O
  const lowercase = 'abcdefghjkmnpqrstuvwxyz' // Excludes ambiguous: i, l, o
  const numbers = '23456789' // Excludes ambiguous: 0, 1

  // Ensure requirements: 1 upper, 1 lower, 1 number
  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]

  // Fill remaining characters from all pools
  const all = uppercase + lowercase + numbers
  for (let i = 3; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  // Shuffle password to avoid predictable pattern
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

/**
 * Register a new client from the Drug Test Wizard
 * Creates a client with auto-generated password
 */
export async function registerClientFromWizard(data: {
  firstName: string
  lastName: string
  middleInitial?: string
  gender: string
  dob: string
  phone: string
  email: string
  clientType: 'self' | 'employment' | 'probation'
  // Court info (for probation)
  courtInfo?: {
    courtName: string
    recipients: Array<{ name: string; email: string }>
  }
  // Employment info (for employment)
  employmentInfo?: {
    employerName: string
    recipients: Array<{ name: string; email: string }>
  }
  // Self info (for self-pay with additional recipients)
  selfInfo?: {
    recipients: Array<{ name: string; email: string }>
  }
}): Promise<{
  success: boolean
  client?: ClientMatch
  generatedPassword?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Check if email already exists
    const existingClient = await payload.find({
      collection: 'clients',
      where: { email: { equals: data.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingClient.docs.length > 0) {
      return {
        success: false,
        error: 'A client with this email already exists. Please search for them instead.',
      }
    }

    // Generate a random password
    const generatedPassword = generateSecurePassword()
    const formattedFirstName = formatPersonName(data.firstName)
    const formattedLastName = formatPersonName(data.lastName)
    const formattedMiddleInitial = formatMiddleInitial(data.middleInitial)
    const formattedPhone = formatPhoneNumber(data.phone)

    // Build client data
    const clientData: any = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      middleInitial: formattedMiddleInitial,
      email: data.email,
      password: generatedPassword,
      gender: data.gender,
      dob: data.dob,
      phone: formattedPhone,
      clientType: data.clientType,
      preferredContactMethod: 'email',
      _verified: true, // Skip email verification for admin-created clients
    }

    // Add type-specific info
    if (data.clientType === 'probation' && data.courtInfo) {
      clientData.courtInfo = data.courtInfo
    } else if (data.clientType === 'employment' && data.employmentInfo) {
      clientData.employmentInfo = data.employmentInfo
    } else if (data.clientType === 'self' && data.selfInfo) {
      clientData.selfInfo = data.selfInfo
    }

    // Create the client
    const newClient = await payload.create({
      collection: 'clients',
      data: clientData,
      overrideAccess: true,
    })

    payload.logger.info(`[registerClientFromWizard] Created client ${newClient.id} for ${data.email}`)

    // Return client data formatted as ClientMatch
    return {
      success: true,
      client: {
        id: newClient.id,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        middleInitial: newClient.middleInitial || undefined,
        email: newClient.email,
        dob: newClient.dob,
        headshot: null, // New client won't have a headshot yet
        matchType: 'exact',
        score: 1,
      },
      generatedPassword,
    }
  } catch (error) {
    payload.logger.error('Error registering client from wizard:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register client',
    }
  }
}
