'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { extract15PanelInstant } from '@/utilities/extractors/extract15PanelInstant'
import { extract11PanelLab } from '@/utilities/extractors/extract11PanelLab'
import type { ParsedPDFData, ClientMatch, TestType } from './types'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { classifyTestResult } from '@/collections/DrugTests/helpers/classifyTestResult'
import { DrugTest } from '@/payload-types'

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
        extracted = await extract11PanelLab(buffer)
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
        matrix[i - 1][j - 1] + cost, // substitution
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
      originalRecipients: [
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
