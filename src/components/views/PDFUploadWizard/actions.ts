'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { extract15PanelInstant } from '@/utilities/extractors/extract15PanelInstant'
import type { ParsedPDFData, ClientMatch } from './types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { classifyTestResult } from '@/collections/DrugTests/helpers/classifyTestResult'

/**
 * Extract data from uploaded PDF file
 */
export async function extractPdfData(formData: FormData): Promise<{
  success: boolean
  data?: ParsedPDFData
  error?: string
}> {
  const file = formData.get('file') as File
  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extract15PanelInstant(buffer)

    return { success: true, data: extracted }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to extract PDF data: ${error.message}`,
    }
  }
}

/**
 * Calculate string similarity score (0-1) using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1

  const len1 = s1.length
  const len2 = s2.length
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen
}

/**
 * Find matching clients using exact match first, then fuzzy search
 */
export async function findMatchingClients(
  firstName: string,
  lastName: string,
  middleInitial?: string
): Promise<{
  matches: ClientMatch[]
  searchTerm: string
}> {
  const payload = await getPayload({ config })

  const searchTerm = middleInitial
    ? `${firstName} ${middleInitial} ${lastName}`
    : `${firstName} ${lastName}`

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
  })

  if (exactMatch.docs.length > 0) {
    return {
      matches: exactMatch.docs.map((client) => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial,
        email: client.email,
        dob: client.dob,
        matchType: 'exact' as const,
      })),
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

  console.log(`[findMatchingClients] Search term: "${searchTerm}"`)
  console.log(`[findMatchingClients] Found ${searchResults.docs.length} search records`)

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
    overrideAccess: true,
  })

  console.log(`[findMatchingClients] Fetched ${clientsResult.docs.length} clients`)

  // Calculate similarity scores for each client
  const scoredMatches = clientsResult.docs
    .map((client) => {
      const clientFullName = [client.firstName, client.middleInitial, client.lastName]
        .filter(Boolean)
        .join(' ')

      const score = calculateSimilarity(searchTerm, clientFullName)

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
    .filter((match) => match.score > 0.2) // Only show 20%+ similarity
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

  console.log(`[searchClients] Searching for: "${searchTerm}"`)

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

  console.log(`[searchClients] Found ${searchResults.docs.length} search docs`)

  // Step 2: Extract client IDs from search results
  const clientIds = searchResults.docs
    .map((searchDoc) => (typeof searchDoc.doc.value === 'string' ? searchDoc.doc.value : null))
    .filter((id): id is string => id !== null)

  console.log(`[searchClients] Extracted ${clientIds.length} client IDs`)

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

  console.log(`[searchClients] Fetched ${clientsResult.docs.length} clients`)

  // Step 4: Calculate similarity scores for each client
  const scoredMatches = clientsResult.docs
    .map((client) => {
      const clientFullName = [client.firstName, client.middleInitial, client.lastName]
        .filter(Boolean)
        .join(' ')

      const emailScore = calculateSimilarity(searchTerm, client.email)
      const nameScore = calculateSimilarity(searchTerm, clientFullName)
      const score = Math.max(emailScore, nameScore) // Use best match

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
    .filter((match) => match.score > 0.2) // Only show 20%+ similarity
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, 10)

  console.log(`[searchClients] Returning ${scoredMatches.length} matches`)

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

  console.log('[getAllClients] Fetching all clients')

  const clientsResult = await payload.find({
    collection: 'clients',
    limit: 1000,
    sort: 'lastName',
    overrideAccess: true,
  })

  console.log(`[getAllClients] Found ${clientsResult.docs.length} clients`)

  const clients = clientsResult.docs.map((client) => ({
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    middleInitial: client.middleInitial || undefined,
    email: client.email,
    dateOfBirth: client.dob,
    matchType: 'fuzzy' as const,
    score: 0,
  }))

  return { clients }
}

/**
 * Get client's active medications for preview
 */
export async function getClientMedications(clientId: string): Promise<{
  medications: Array<{ name: string; detectedAs: string[] }>
}> {
  const payload = await getPayload({ config })

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    if (!client?.medications || !Array.isArray(client.medications)) {
      return { medications: [] }
    }

    const activeMeds = client.medications
      .filter((med: any) => med.status === 'active')
      .map((med: any) => ({
        name: med.medicationName,
        detectedAs: (med.detectedAs || []).filter((s: string) => s !== 'none'),
      }))

    return { medications: activeMeds }
  } catch (error) {
    console.error('Error fetching client medications:', error)
    return { medications: [] }
  }
}

/**
 * Compute test result preview (same logic as computeTestResults hook)
 */
export async function computeTestResultPreview(
  clientId: string,
  detectedSubstances: SubstanceValue[],
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

  try {
    // Fetch client with medications
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    if (!client) {
      throw new Error('Client not found')
    }

    // Extract expected substances from active medications
    const expectedSubstances = new Set<string>()
    const criticalSubstances = new Set<string>()

    if (client.medications && Array.isArray(client.medications)) {
      const activeMedications = client.medications.filter((med: any) => med.status === 'active')

      activeMedications.forEach((med: any) => {
        const substances = (med.detectedAs || []).filter((s: string) => s !== 'none')

        substances.forEach((substance: string) => {
          expectedSubstances.add(substance)
          if (med.requireConfirmation === true) {
            criticalSubstances.add(substance)
          }
        })
      })
    }

    // Convert to sets for comparison
    const detectedSet = new Set(detectedSubstances)
    const expectedSet = expectedSubstances

    // Compute result arrays
    const expectedPositives: string[] = []
    const unexpectedPositives: string[] = []
    const unexpectedNegatives: string[] = []
    const criticalNegatives: string[] = []

    // Check detected substances
    detectedSet.forEach((substance) => {
      if (expectedSet.has(substance)) {
        expectedPositives.push(substance)
      } else {
        unexpectedPositives.push(substance)
      }
    })

    // Check for missing expected substances
    expectedSet.forEach((substance) => {
      if (!detectedSet.has(substance as SubstanceValue)) {
        if (criticalSubstances.has(substance)) {
          criticalNegatives.push(substance)
        } else {
          unexpectedNegatives.push(substance)
        }
      }
    })

    // Determine overall result classification
    const classification = classifyTestResult({
      detectedCount: detectedSet.size,
      expectedCount: expectedSet.size,
      unexpectedPositivesCount: unexpectedPositives.length,
      unexpectedNegativesCount: unexpectedNegatives.length,
      criticalNegativesCount: criticalNegatives.length,
    })

    return {
      initialScreenResult: classification.initialScreenResult,
      expectedPositives,
      unexpectedPositives,
      unexpectedNegatives: [...unexpectedNegatives, ...criticalNegatives],
      autoAccept: classification.autoAccept,
    }
  } catch (error) {
    console.error('Error computing test result preview:', error)
    throw error
  }
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
}): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
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

    // 2. Create drug test record (computeTestResults hook will run automatically)
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: data.clientId,
        testType: data.testType,
        collectionDate: data.collectionDate,
        detectedSubstances: data.detectedSubstances,
        isDilute: data.isDilute,
        testDocument: uploadedFile.id,
        screeningStatus: 'screened', // Mark as screened since we have results
        processNotes: 'Created via PDF upload wizard',
      },
      overrideAccess: true,
    })

    return { success: true, testId: drugTest.id }
  } catch (error: any) {
    console.error('Error creating drug test:', error)
    return {
      success: false,
      error: `Failed to create drug test: ${error.message}`,
    }
  }
}
