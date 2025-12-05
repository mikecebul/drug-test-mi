'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { extract15PanelInstant } from '@/utilities/extractors/extract15PanelInstant'
import { extractLabTest } from '@/utilities/extractors/extractLabTest'
import type { ParsedPDFData, ClientMatch, TestType } from './types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { classifyTestResult } from '@/collections/DrugTests/helpers/classifyTestResult'
import { DrugTest } from '@/payload-types'
import { calculateSimilarity } from './utils/calculateSimilarity'

/**
 * Extract data from uploaded PDF file
 */
export async function extractPdfData(
  formData: FormData,
  testType?: TestType,
): Promise<{
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

    // Route to the appropriate parser based on test type
    let extracted: ParsedPDFData

    switch (testType) {
      case '11-panel-lab':
      case '17-panel-sos-lab':
      case 'etg-lab':
        // All lab tests use the same extractor which auto-detects the specific type
        extracted = await extractLabTest(buffer)
        break
      case '15-panel-instant':
      default:
        // Default to 15-panel instant for backward compatibility
        extracted = await extract15PanelInstant(buffer)
        break
    }

    return { success: true, data: extracted }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to extract PDF data: ${error.message}`,
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
export async function getClientMedications(clientId: string): Promise<
  | { success: true; medications: Array<{ name: string; detectedAs: string[] }> }
  | { success: false; error: string }
> {
  const payload = await getPayload({ config })

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    if (!client?.medications || !Array.isArray(client.medications)) {
      return { success: true, medications: [] }
    }

    const activeMeds = client.medications
      .filter((med: any) => med.status === 'active')
      .map((med: any) => ({
        name: med.medicationName,
        detectedAs: (med.detectedAs || []).filter((s: string) => s !== 'none'),
      }))

    return { success: true, medications: activeMeds }
  } catch (error) {
    console.error('Error fetching client medications:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch client medications',
    }
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
        ? 'Created via PDF upload wizard with lab confirmation results'
        : 'Created via PDF upload wizard',
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
  } catch (error: any) {
    console.error('Error creating drug test:', error)
    return {
      success: false,
      error: `Failed to create drug test: ${error.message}`,
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
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
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
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/templates')

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
    const { clientEmail, referralEmails } = await getRecipients(data.clientId, payload)

    // Compute test result preview (for email content)
    const previewResult = await computeTestResultPreview(data.clientId, data.detectedSubstances)

    // Build email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const emailData = buildScreenedEmail({
      clientName,
      collectionDate: data.collectionDate,
      testType: data.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: data.detectedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: data.isDilute,
    })

    // Determine smart grouping based on client type
    const smartGrouping = client.clientType === 'self' ? 'combined' : 'separate'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error: any) {
    console.error('Error generating email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error.message}`,
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
  collectionTime: string
}): Promise<{
  success: boolean
  data?: {
    referralEmails: string[]
    referralHtml: string
    referralSubject: string
  }
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildCollectedEmail } = await import('@/collections/DrugTests/email/templates')

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
    const { referralEmails } = await getRecipients(data.clientId, payload)

    // Build collection email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const dateTimeStr = `${data.collectionDate} ${data.collectionTime}`
    const collectionDate = new Date(dateTimeStr).toISOString()

    const emailData = buildCollectedEmail({
      clientName,
      collectionDate,
      testType: data.testType,
    })

    return {
      success: true,
      data: {
        referralEmails,
        referralHtml: emailData.html,
        referralSubject: emailData.subject,
      },
    }
  } catch (error: any) {
    console.error('Error generating collection email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error.message}`,
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
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
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
    const { buildCompleteEmail } = await import('@/collections/DrugTests/email/templates')

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
    const { clientEmail, referralEmails } = await getRecipients(data.clientId, payload)

    // Compute initial test result for email (need this for complete email template)
    const previewResult = await computeTestResultPreview(
      data.clientId,
      drugTest.detectedSubstances as any,
    )

    // Determine final status based on confirmation results
    // This logic matches computeTestResults.ts lines 158-211
    const confirmationResults = data.confirmationResults
    const confirmedPositiveCount = confirmationResults.filter(
      (r) => r.result === 'confirmed-positive',
    ).length
    const inconclusiveCount = confirmationResults.filter((r) => r.result === 'inconclusive').length

    let finalStatus: string

    if (inconclusiveCount > 0) {
      // If any confirmation came back inconclusive, overall result is inconclusive
      finalStatus = 'inconclusive'
    } else if (confirmedPositiveCount > 0) {
      // At least one substance confirmed positive = FAIL
      // Check if there are also unexpected negatives (from initial screen)
      if (
        previewResult.initialScreenResult === 'mixed-unexpected' ||
        previewResult.initialScreenResult === 'unexpected-negative-critical' ||
        previewResult.initialScreenResult === 'unexpected-negative-warning'
      ) {
        finalStatus = 'mixed-unexpected'
      } else {
        finalStatus = 'unexpected-positive'
      }
    } else {
      // All confirmations came back negative (false positives ruled out)
      // The initial "unexpected positive" was a false alarm

      // Check if there were unexpected negatives from initial screen
      if (
        previewResult.initialScreenResult === 'unexpected-negative-critical' ||
        previewResult.initialScreenResult === 'mixed-unexpected'
      ) {
        // Critical medications missing = still FAIL
        finalStatus = 'unexpected-negative-critical'
      } else if (previewResult.initialScreenResult === 'unexpected-negative-warning') {
        // Only warning-level medications missing = WARNING (still technically compliant)
        finalStatus = 'unexpected-negative-warning'
      } else if (previewResult.expectedPositives.length > 0) {
        // Had expected positives and confirmations ruled out false positives = PASS
        finalStatus = 'expected-positive'
      } else {
        // All negative, confirmations ruled out false positives = PASS
        finalStatus = 'confirmed-negative'
      }
    }

    // Build complete email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const emailData = buildCompleteEmail({
      clientName,
      collectionDate: drugTest.collectionDate || '',
      testType: drugTest.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: drugTest.detectedSubstances as any,
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
    })

    // Determine smart grouping based on client type
    const smartGrouping = client.clientType === 'self' ? 'combined' : 'separate'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error: any) {
    console.error('Error generating confirmation email preview:', error)
    return {
      success: false,
      error: `Failed to generate confirmation email preview: ${error.message}`,
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
    pdfBuffer: number[]
    pdfFilename: string
    hasConfirmation?: boolean
    confirmationResults?: Array<{
      substance: SubstanceValue
      result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
      notes?: string
    }>
  },
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
    // Import email functions
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/templates')
    const { createAdminAlert } = await import('@/lib/admin-alerts')

    // Convert number array back to Buffer
    const buffer = Buffer.from(testData.pdfBuffer)

    // 1. Upload PDF to private-media collection
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

    // 2. Prepare drug test data
    const drugTestData: any = {
      relatedClient: testData.clientId,
      testType: testData.testType,
      collectionDate: testData.collectionDate,
      detectedSubstances: testData.detectedSubstances,
      isDilute: testData.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      processNotes: testData.hasConfirmation
        ? 'Created via PDF upload wizard with email review and lab confirmation results'
        : 'Created via PDF upload wizard with email review',
      sendNotifications: false, // Prevent auto-send
    }

    // 3. Add confirmation data if present (lab tests)
    if (
      testData.hasConfirmation &&
      testData.confirmationResults &&
      testData.confirmationResults.length > 0
    ) {
      const confirmationSubstances = testData.confirmationResults.map((r) => r.substance)

      drugTestData.confirmationDecision = 'request-confirmation'
      drugTestData.confirmationSubstances = confirmationSubstances
      drugTestData.confirmationResults = testData.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }

    // 4. Create drug test record with skipNotificationHook context
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: drugTestData,
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // 3. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
    })

    // 4. Compute test results for email content
    const previewResult = await computeTestResultPreview(
      testData.clientId,
      testData.detectedSubstances,
    )

    // 5. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const emailData = buildScreenedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: testData.detectedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: testData.isDilute,
    })

    // 6. Fetch document for attachment
    const testDocument = await payload.findByID({
      collection: 'private-media',
      id: uploadedFile.id,
      overrideAccess: true,
    })

    // 7. Read file buffer (handle S3 vs local)
    let fileBuffer: Buffer
    const isS3Enabled = Boolean(process.env.NEXT_PUBLIC_S3_HOSTNAME)

    if (isS3Enabled) {
      // Production: Fetch from S3
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const s3Client = new S3Client({
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        region: process.env.S3_REGION,
      })

      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `private/${testDocument.filename}`,
      })

      const response = await s3Client.send(command)
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      fileBuffer = Buffer.concat(chunks)
    } else {
      // Development: Read from local disk
      const { promises: fsPromises } = await import('fs')
      const path = await import('path')
      const localPath = path.join(process.cwd(), 'private-media', testDocument.filename!)
      fileBuffer = await fsPromises.readFile(localPath)
    }

    // 8. Send emails
    const sentTo: string[] = []
    const failedTo: string[] = []

    // Send client email if enabled
    if (emailConfig.clientEmailEnabled && emailConfig.clientRecipients.length > 0) {
      for (const email of emailConfig.clientRecipients) {
        try {
          await payload.sendEmail({
            to: email,
            from: payload.email.defaultFromAddress,
            subject: emailData.client.subject,
            html: emailData.client.html,
            attachments: [
              {
                filename: testDocument.filename || 'drug-test-report.pdf',
                content: fileBuffer,
                contentType: 'application/pdf',
              },
            ],
          })
          sentTo.push(`Client: ${email}`)
        } catch (error) {
          console.error(`Failed to send client email to ${email}:`, error)
          failedTo.push(`Client: ${email}`)

          // Create admin alert for failed client email
          await createAdminAlert(payload, {
            severity: 'critical',
            alertType: 'email-failure',
            title: `Client email failed - ${clientName}`,
            message: `URGENT: Failed to send screening results email to client.\n\nClient: ${clientName}\nClient Email: ${email}\nStage: screened\nDrug Test ID: ${drugTest.id}\n\nThe client is expecting these results. Please send manually or contact the client.`,
            context: {
              drugTestId: drugTest.id,
              clientId: testData.clientId,
              clientName,
              recipientEmail: email,
              recipientType: 'client',
              emailStage: 'screened',
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }

    // Send referral emails if enabled
    if (emailConfig.referralEmailEnabled && emailConfig.referralRecipients.length > 0) {
      for (const email of emailConfig.referralRecipients) {
        try {
          await payload.sendEmail({
            to: email,
            from: payload.email.defaultFromAddress,
            subject: emailData.referrals.subject,
            html: emailData.referrals.html,
            attachments: [
              {
                filename: testDocument.filename || 'drug-test-report.pdf',
                content: fileBuffer,
                contentType: 'application/pdf',
              },
            ],
          })
          sentTo.push(`Referral: ${email}`)
        } catch (error) {
          console.error(`Failed to send referral email to ${email}:`, error)
          failedTo.push(`Referral: ${email}`)

          // Create admin alert for failed referral email
          await createAdminAlert(payload, {
            severity: 'critical',
            alertType: 'email-failure',
            title: `Referral email failed - ${clientName}`,
            message: `URGENT: Failed to send screening results email to referral.\n\nClient: ${clientName}\nReferral Email: ${email}\nStage: screened\nDrug Test ID: ${drugTest.id}\n\nThis referral is expecting these results. Please send manually ASAP.`,
            context: {
              drugTestId: drugTest.id,
              clientId: testData.clientId,
              clientName,
              recipientEmail: email,
              recipientType: 'referral',
              emailStage: 'screened',
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }

    // 9. Update notification history
    const notificationEntry = {
      stage: 'screened',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      optedOutBy: 'wizard',
      originalRecipients:
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

    return { success: true, testId: drugTest.id }
  } catch (error: any) {
    console.error('Error creating drug test with email review:', error)
    return {
      success: false,
      error: `Failed to create drug test: ${error.message}`,
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
  } catch (error: any) {
    console.error('Error creating collection-only test:', error)
    return {
      success: false,
      error: `Failed to create collection record: ${error.message}`,
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
    // Import email functions
    const { buildCollectedEmail } = await import('@/collections/DrugTests/email/templates')
    const { createAdminAlert } = await import('@/lib/admin-alerts')

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

    // 3. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const emailData = buildCollectedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
    })

    // 4. Send emails if enabled
    const sentTo: string[] = []
    const failedTo: string[] = []

    // Send referral emails if enabled
    if (emailConfig.referralEmailEnabled && emailConfig.referralRecipients.length > 0) {
      for (const email of emailConfig.referralRecipients) {
        try {
          await payload.sendEmail({
            to: email,
            from: payload.email.defaultFromAddress,
            subject: emailData.subject,
            html: emailData.html,
          })
          sentTo.push(`Referral: ${email}`)
        } catch (error) {
          console.error(`Failed to send referral email to ${email}:`, error)
          failedTo.push(`Referral: ${email}`)

          // Create admin alert for failed referral email
          await createAdminAlert(payload, {
            severity: 'critical',
            alertType: 'email-failure',
            title: `Collection notification failed - ${clientName}`,
            message: `URGENT: Failed to send collection notification to referral.\n\nClient: ${clientName}\nReferral Email: ${email}\nStage: collected\nDrug Test ID: ${drugTest.id}\n\nThis referral is expecting notification. Please send manually ASAP.`,
            context: {
              drugTestId: drugTest.id,
              clientId: testData.clientId,
              clientName,
              recipientEmail: email,
              recipientType: 'referral',
              emailStage: 'collected',
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }

    // 5. Update notification history
    const notificationEntry = {
      stage: 'collected',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      optedOutBy: 'wizard',
      originalRecipients:
        emailConfig.referralRecipients.map((e) => `Referral: ${e}`).join(', ') || null,
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

    return { success: true, testId: drugTest.id }
  } catch (error: any) {
    console.error('Error creating collection with email review:', error)
    return {
      success: false,
      error: `Failed to create collection: ${error.message}`,
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
      typeof existingTest.relatedClient === 'string'
        ? existingTest.relatedClient
        : existingTest.relatedClient.id

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

    // 4. Add confirmation data if present
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

    // 5. Update the drug test
    await payload.update({
      collection: 'drug-tests',
      id: data.testId,
      data: updateData,
      overrideAccess: true,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating test with screening:', error)
    return {
      success: false,
      error: `Failed to update test: ${error.message}`,
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
      typeof existingTest.relatedClient === 'string'
        ? existingTest.relatedClient
        : existingTest.relatedClient.id

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
  } catch (error: any) {
    console.error('Error updating test with confirmation:', error)
    return {
      success: false,
      error: `Failed to update confirmation: ${error.message}`,
    }
  }
}

/**
 * Get client data from a drug test
 */
export async function getClientFromTest(testId: string): Promise<{
  success: boolean
  client?: {
    id: string
    firstName: string
    lastName: string
    middleInitial?: string | null
    email: string
    dob?: string | null
  }
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Fetch the drug test with the related client
    const drugTest = await payload.findByID({
      collection: 'drug-tests',
      id: testId,
      depth: 1, // Get the full client object
    })

    if (!drugTest) {
      return { success: false, error: 'Drug test not found' }
    }

    // Extract client data
    const client = typeof drugTest.relatedClient === 'object' ? drugTest.relatedClient : null

    if (!client) {
      return { success: false, error: 'No client associated with this test' }
    }

    // Return only the necessary client fields
    return {
      success: true,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial,
        email: client.email,
        dob: client.dob,
      },
    }
  } catch (error: any) {
    console.error('Error fetching client from drug test:', error)
    return {
      success: false,
      error: `Failed to fetch client: ${error.message}`,
    }
  }
}

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
      depth: 1,
    })

    // Map to simplified format
    return {
      success: true,
      tests: result.docs.map((test) => ({
        id: test.id,
        clientName: test.clientName || 'Unknown',
        testType: test.testType,
        collectionDate: test.collectionDate || '',
        screeningStatus: test.screeningStatus,
      })),
    }
  } catch (error) {
    console.error('Error fetching pending tests:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pending tests',
    }
  }
}
