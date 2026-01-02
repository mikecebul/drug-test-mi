import type { SubstanceValue } from '@/fields/substanceOptions'
import { TZDate } from '@date-fns/tz'

/**
 * Extracted data from lab test PDF (11-panel, 17-panel SOS, or EtG)
 */
export interface ExtractedLabData {
  donorName: string | null
  collectionDate: string | null // ISO string in UTC
  detectedSubstances: SubstanceValue[] // From "Screen" column
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]
  testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  hasConfirmation: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}

/**
 * Extract data from lab test PDF using pdf-parse
 *
 * Expected PDF format: Redwood Toxicology Laboratory
 * - Donor Name: [Full Name]
 * - Collected: [MM/DD/YYYY HH:MM AM/PM]
 * - Tests Ordered: Determines test type
 *   - "049 - Ethyl Glucuronide (EtG)" = EtG Lab
 *   - "B306 - Urine 17 Panel" = 17-Panel SOS Lab
 *   - Default = 11-Panel Lab
 * - Substance results table with "Screen" and "Confirmation" columns
 * - Screen column: "Negative" or "Screened Positive"
 * - Confirmation column: LC-MS/MS results with ng/mL values or blank
 * - Optional "dilute" indicator
 *
 * @param buffer - PDF file buffer
 * @returns Extracted data with confidence score
 */
export async function extractLabTest(buffer: Buffer): Promise<ExtractedLabData> {
  // Dynamically import pdf-parse to avoid build-time issues with canvas/browser APIs
  const { CanvasFactory } = await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')

  // Parse PDF using pdf-parse with CanvasFactory for Node.js compatibility
  const parser = new PDFParse({ data: buffer, CanvasFactory })

  try {
    const data = await parser.getText()
    const text = data.text

    // Detect test type from "Tests Ordered" section
    let testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab' = '11-panel-lab'
    if (/(049|050)\s*-?\s*Ethyl Glucuronide/i.test(text) || /(049|050)\s*-?\s*EtG/i.test(text)) {
      // EtG test ordered (codes 049 or 050 with flexible formatting)
      testType = 'etg-lab'
    } else if (/B306\s*-?\s*Urine 17 Panel/i.test(text)) {
      testType = '17-panel-sos-lab'
    }

    // Initialize result object
    const result: ExtractedLabData = {
      donorName: null,
      collectionDate: null,
      detectedSubstances: [],
      isDilute: false,
      rawText: text,
      confidence: 'low',
      extractedFields: [],
      testType,
      hasConfirmation: false,
      confirmationResults: [],
    }

    // Extract donor name
    // Strategy 1: Look for name between "Accession #:" and date pattern
    // Pattern: "Accession #:\nTom V Vachon\n11/19/2025" or "ALEX WAHA\n11/21/2025"
    const accessionMatch = text.match(/Accession #:[^]*?([A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z]+)/i)
    if (accessionMatch) {
      const name = accessionMatch[1].trim().replace(/\s+/g, ' ')
      // Filter out false positives
      const falsePositives = ['MI Drug Test', 'Drug Test', 'Collected by', 'Tom Brooks']
      if (!falsePositives.some(fp => name.includes(fp)) && name.split(/\s+/).length >= 2) {
        result.donorName = name
        result.extractedFields.push('donorName')
      }
    }

    // Strategy 2: Look for all-caps name pattern (fallback)
    if (!result.donorName) {
      const nameMatch = text.match(/\b([A-Z]{2,}(?:\s+[A-Z]\.?)?\s+[A-Z]{2,})\b/)
      if (nameMatch) {
        const name = nameMatch[1].trim().replace(/\s+/g, ' ')
        // Filter out false positives
        const falsePositives = ['SPECIMEN TYPE', 'DRUG TEST', 'MI DRUG', 'SANTA ROSA', 'DRUG CLASS', 'EIA', 'THC']
        if (!falsePositives.some(fp => name.includes(fp)) && name.split(/\s+/).length >= 2) {
          result.donorName = name
          result.extractedFields.push('donorName')
        }
      }
    }

    // Extract collection date
    // Strategy 1: Look for date after donor name (most reliable)
    // The collected date appears near the donor name: "Jamey E Carter\n11/11/2025\n...\n06:33 PM"
    if (result.donorName) {
      const nameIdx = text.indexOf(result.donorName)
      if (nameIdx > -1) {
        // Look for date within 200 chars after the name
        const textAfterName = text.substring(nameIdx + result.donorName.length, nameIdx + result.donorName.length + 200)
        const dateMatch = textAfterName.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
        const timeMatch = textAfterName.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i)

        if (dateMatch) {
          const dateStr = dateMatch[1]
          if (timeMatch) {
            // Found both date and time - parse as EST/EDT
            const timeStr = timeMatch[1]
            const parsed = parseDateTimeInEST(dateStr, timeStr)
            if (parsed && !isNaN(parsed.getTime())) {
              // Return ISO string instead of Date object to avoid serialization issues
              result.collectionDate = parsed.toISOString()
              result.extractedFields.push('collectionDate')
            }
          } else {
            // Only date found, use default time (12:00 AM EST)
            const parsed = parseDateTimeInEST(dateStr, '12:00 AM')
            if (parsed && !isNaN(parsed.getTime())) {
              // Return ISO string instead of Date object to avoid serialization issues
              result.collectionDate = parsed.toISOString()
              result.extractedFields.push('collectionDate')
            }
          }
        }
      }
    }

    // Strategy 2: Look for "Collected:" label (fallback)
    // Note: This can be unreliable as the date after "Collected:" might be the received date
    // Only use this if we couldn't find the date near the donor name
    if (!result.collectionDate) {
      const collectedIdx = text.indexOf('Collected:')
      if (collectedIdx > -1) {
        // Look for date within 100 chars after "Collected:"
        const textAfterCollected = text.substring(collectedIdx + 10, collectedIdx + 110)
        const dateMatch = textAfterCollected.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)

        if (dateMatch) {
          const dateStr = dateMatch[1]
          // Look for time nearby - could be on same line or within next 50 chars
          const timeMatch = textAfterCollected.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i)

          if (timeMatch) {
            // Found both date and time - parse as EST/EDT
            const timeStr = timeMatch[1]
            const parsed = parseDateTimeInEST(dateStr, timeStr)
            if (parsed && !isNaN(parsed.getTime())) {
              // Return ISO string instead of Date object to avoid serialization issues
              result.collectionDate = parsed.toISOString()
              result.extractedFields.push('collectionDate')
            }
          } else {
            // Only date found, use default time (12:00 AM EST)
            const parsed = parseDateTimeInEST(dateStr, '12:00 AM')
            if (parsed && !isNaN(parsed.getTime())) {
              // Return ISO string instead of Date object to avoid serialization issues
              result.collectionDate = parsed.toISOString()
              result.extractedFields.push('collectionDate')
            }
          }
        }
      }
    }

    // Check for dilute
    if (/dilute/i.test(text)) {
      result.isDilute = true
      result.extractedFields.push('isDilute')
    }

    // Substance mapping - comprehensive for all lab test types
    const substanceMapping: Record<string, SubstanceValue> = {
      // 11-Panel Lab
      'Amphetamines 500': 'amphetamines',
      'Amphetamines': 'amphetamines',
      'Benzodiazepines': 'benzodiazepines',
      'Buprenorphine': 'buprenorphine',
      'Cocaine (Benzoylecgonine)': 'cocaine',
      'Benzoylecgonine': 'cocaine',
      'Ethyl Glucuronide (EtG)': 'etg',
      'Ethyl Glucuronide': 'etg',
      'Fentanyls': 'fentanyl',
      'Methadone': 'methadone',
      'Mitragynine': 'kratom',
      'Opiates': 'opiates',
      'THC (Marijuana)': 'thc',

      // 17-Panel SOS additions
      // IMPORTANT: Alcohol (Ethanol) detects CURRENT intoxication, EtG detects PAST use (24-48hrs)
      'Alcohol (Ethanol)': 'alcohol',
      'Methylenedioxymethamphetamine (MDMA)': 'mdma',
      'MDMA': 'mdma',
      'Barbiturates': 'barbiturates',
      'Methadone Metabolite': 'methadone', // Metabolite counted as parent
      'Oxycodone / Noroxycodone': 'oxycodone',
      'Oxycodone': 'oxycodone',
      'Phencyclidine (PCP)': 'pcp',
      'PCP': 'pcp',
      'Propoxyphene': 'propoxyphene',
      'Methaqualone': 'tricyclic_antidepressants', // Map to closest match
    }

    // Extract substances from screening
    for (const [pdfName, systemValue] of Object.entries(substanceMapping)) {
      // Pattern: Substance name followed by "Screened Positive" or "Negative" then cutoff
      const pattern = new RegExp(
        `${escapeRegex(pdfName)}\\s+(Negative|Screened Positive)\\s+\\d+\\s*ng/mL`,
        'i'
      )
      const match = text.match(pattern)
      if (match && match[1].toLowerCase().includes('positive')) {
        if (!result.detectedSubstances.includes(systemValue)) {
          result.detectedSubstances.push(systemValue)
        }
      }
    }

    if (result.detectedSubstances.length > 0) {
      result.extractedFields.push('detectedSubstances')
    }

    // Extract confirmation results (LC-MS/MS)
    // Pattern: "Substance* LC/MS/MS cutoff Negative" or "Substance* LC/MS/MS cutoff value"
    // The PDF may have specific substance names with asterisks like "Fentanyl*" or "Acetyl fentanyl*"
    for (const [pdfName, systemValue] of Object.entries(substanceMapping)) {
      // Look for LC/MS/MS confirmation results
      // Format: "Fentanyl* LC/MS/MS 0.5 ng/mL Negative" or with a numeric value
      // Use a flexible pattern that matches the substance name (possibly with asterisk and variants)
      const baseName = pdfName.replace(/s$/, '').replace(/\(.*?\)/g, '').trim() // Remove plural 's' and parentheses
      const confirmPattern = new RegExp(
        `${escapeRegex(baseName)}[\\w\\s]*?\\*?\\s+LC[/\\s-]*MS[/\\s-]*MS\\s+[\\d.]+\\s*ng/mL\\s+(Negative|Positive|[\\d.]+)`,
        'i'
      )

      const confirmMatch = text.match(confirmPattern)
      if (confirmMatch) {
        result.hasConfirmation = true

        // Determine if confirmed positive, negative, or inconclusive
        const confirmValue = confirmMatch[1].toLowerCase()
        let confirmResult: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'

        if (confirmValue.includes('negative')) {
          confirmResult = 'confirmed-negative'
        } else if (confirmValue.includes('positive') || /^\d+/.test(confirmValue)) {
          // If there's a numeric value or "positive", it's confirmed positive
          confirmResult = 'confirmed-positive'
        } else {
          confirmResult = 'inconclusive'
        }

        // Add to confirmation results if not already present
        const existingConfirm = result.confirmationResults?.find((r) => r.substance === systemValue)
        if (!existingConfirm) {
          result.confirmationResults?.push({
            substance: systemValue,
            result: confirmResult,
            notes: confirmMatch[1], // Store the raw value (e.g., "Negative" or "5")
          })
        }
      }
    }

    if (result.hasConfirmation && result.confirmationResults && result.confirmationResults.length > 0) {
      result.extractedFields.push('confirmationResults')
    }

    // Determine confidence
    if (result.donorName && result.collectionDate) {
      result.confidence = 'high'
    } else if (result.donorName || result.collectionDate) {
      result.confidence = 'medium'
    }

    return result
  } catch (error) {
    throw new Error(`Failed to extract lab test data: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    // Always destroy the parser to prevent memory leaks, even if an error occurs
    await parser.destroy()
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse a date/time string as Eastern Time (EST/EDT) and convert to UTC
 *
 * Drug test collection times are always recorded in America/New_York timezone
 * regardless of where the server runs. This ensures consistent timestamps.
 *
 * @param dateStr - Date in MM/DD/YYYY format (e.g., "11/20/2025")
 * @param timeStr - Time in 12-hour format (e.g., "06:27 PM")
 * @returns Date object in UTC, or null if parsing fails
 */
function parseDateTimeInEST(dateStr: string, timeStr: string): Date | null {
  try {
    // Parse date components: "11/20/2025" -> month=11, day=20, year=2025
    const [monthStr, dayStr, yearStr] = dateStr.split('/')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) - 1 // JavaScript months are 0-indexed
    const day = parseInt(dayStr, 10)

    // Parse time components: "06:27 PM" -> hours=18, minutes=27
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!timeMatch) return null

    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const isPM = timeMatch[3].toUpperCase() === 'PM'

    // Convert to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12
    } else if (!isPM && hours === 12) {
      hours = 0
    }

    // Create a TZDate which interprets these values as America/New_York time
    // and returns a proper UTC Date object
    return new TZDate(year, month, day, hours, minutes, 0, 'America/New_York')
  } catch {
    return null
  }
}
