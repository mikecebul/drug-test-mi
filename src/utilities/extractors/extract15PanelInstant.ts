// Import worker before PDFParse to fix Next.js/serverless environments
import 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'
import type { SubstanceValue } from '@/fields/substanceOptions'

/**
 * Extracted data from 15-panel instant test PDF
 */
export interface Extracted15PanelData {
  donorName: string | null
  collectionDate: Date | null
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]
}

/**
 * Extract data from 15-panel instant test PDF using pdf-parse
 *
 * Expected PDF format:
 * - Donor Name: [Full Name]
 * - Collected: [MM/DD/YYYY HH:MM AM/PM]
 * - Substance results table with NEG/POS indicators
 * - Optional "dilute" indicator
 *
 * @param buffer - PDF file buffer
 * @returns Extracted data with confidence score
 */
export async function extract15PanelInstant(buffer: Buffer): Promise<Extracted15PanelData> {
  // Parse PDF using pdf-parse (better than pdf2json)
  const parser = new PDFParse({ data: buffer })

  try {
    const data = await parser.getText()
    const text = data.text

    // Initialize result object
    const result: Extracted15PanelData = {
      donorName: null,
      collectionDate: null,
      detectedSubstances: [],
      isDilute: false,
      rawText: text,
      confidence: 'low',
      extractedFields: [],
    }

    // Extract donor name
    // pdf-parse preserves layout: donor name appears after phone number or before "iCup" test description
    // Pattern: "Phone: (231)373-6341\nDennis D Erfourth"

    // Strategy 1: Look for name after phone number (most reliable)
    let donorNameMatch = text.match(/Phone:\s*\(\d{3}\)\d{3}-\d{4}\s*\n\s*([A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z]+)/i)

    // Strategy 2: Look for name before "iCup" test description
    if (!donorNameMatch) {
      donorNameMatch = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z]+)\s*\n\s*iCup\s+Urine/i)
    }

    // Strategy 3: Look for donor signature at bottom (before "Page X of Y")
    if (!donorNameMatch) {
      donorNameMatch = text.match(/Donor Signature\s*\n\s*([A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z]+)/i)
    }

    if (donorNameMatch) {
      result.donorName = donorNameMatch[1].trim().replace(/\s+/g, ' ')
      result.extractedFields.push('donorName')
    }

    // Extract collection date
    // pdf-parse shows: "Collected:\n...\nMike Cebulski\n06:27 PM\t11/20/2025"
    // Pattern: time with tab separator then date
    let collectedMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[\t\n]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)

    if (collectedMatch) {
      const timeStr = collectedMatch[1]
      const dateStr = collectedMatch[2]

      // Combine date and time
      const dateTimeStr = `${dateStr} ${timeStr}`
      const parsed = new Date(dateTimeStr)

      if (!isNaN(parsed.getTime())) {
        result.collectionDate = parsed
        result.extractedFields.push('collectionDate')
      }
    } else {
      // Fallback: Try standard format
      collectedMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
      if (collectedMatch) {
        const dateStr = collectedMatch[1]
        const timeStr = collectedMatch[2]

        const dateTimeStr = `${dateStr} ${timeStr}`
        const parsed = new Date(dateTimeStr)

        if (!isNaN(parsed.getTime())) {
          result.collectionDate = parsed
          result.extractedFields.push('collectionDate')
        }
      }
    }

    // Check for dilute sample
    // Pattern: look for "dilute" keyword (case-insensitive)
    if (/dilute/i.test(text)) {
      result.isDilute = true
      result.extractedFields.push('isDilute')
    }

    // Extract substance results
    // Map PDF substance names to our system values
    const substanceMapping: Record<string, SubstanceValue> = {
      '6-Monoacetylmorphine': '6-mam',
      '6-MAM': '6-mam',
      'Amphetamines': 'amphetamines',
      'Benzodiazepines': 'benzodiazepines',
      'Buprenorphine': 'buprenorphine',
      'Cocaine': 'cocaine',
      'EtG': 'etg',
      'Fentanyl': 'fentanyl',
      'Methylenedioxymethamphetamine': 'mdma',
      'MDMA': 'mdma',
      'Methadone': 'methadone',
      'Methamphetamine': 'methamphetamines',
      'Opiates': 'opiates',
      'Oxycodone': 'oxycodone',
      'Synthetic Cannabinoids': 'synthetic_cannabinoids',
      'THC': 'thc',
      'Tramadol': 'tramadol',
    }

    // For each substance mapping, check if it's marked as positive in the PDF
    // pdf-parse shows clean lines like: "Buprenorphine Presumptive Positive 10 ng/mL\tCIA"
    for (const [pdfName, systemValue] of Object.entries(substanceMapping)) {
      // Pattern: Substance name followed by result status
      // Results can be: "Negative", "Presumptive Positive", or just "Positive"
      const pattern = new RegExp(
        `${escapeRegex(pdfName)}[^\\n]{0,100}?(Negative|Presumptive Positive|Positive)`,
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

    // Determine confidence level
    if (result.donorName && result.collectionDate) {
      result.confidence = 'high'
    } else if (result.donorName || result.collectionDate) {
      result.confidence = 'medium'
    }

    return result
  } catch (error) {
    throw new Error(`Failed to extract 15-panel instant test data: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    // Always destroy the parser to prevent memory leaks, even if an error occurs
    await parser.destroy()
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
