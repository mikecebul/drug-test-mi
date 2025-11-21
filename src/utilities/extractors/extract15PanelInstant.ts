import PDFParser from 'pdf2json'
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
 * Extract data from 15-panel instant test PDF
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
  try {
    // Parse PDF to extract raw text using pdf2json
    const pdfParser = new PDFParser()

    // Create promise to handle async parsing
    const parsePdf = new Promise<string>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(errData.parserError))
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        // Extract text from parsed PDF data
        let text = ''
        pdfData.Pages?.forEach((page: any) => {
          page.Texts?.forEach((textItem: any) => {
            textItem.R?.forEach((run: any) => {
              if (run.T) {
                text += decodeURIComponent(run.T) + ' '
              }
            })
          })
        })
        resolve(text)
      })

      // Parse the buffer
      pdfParser.parseBuffer(buffer)
    })

    const text = await parsePdf
 
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
    // pdf2json scrambles the layout. Multiple strategies to find the name:

    // Strategy 1: Look for name at bottom right (after "Page X of Y" line)
    // Pattern: "Page 1 of 1 [spaces] Michael Cebulski"
    let donorNameMatch = text.match(/Page\s+\d+\s+of\s+\d+[^\w]+([A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+)/i)

    // Strategy 2: Name after the phone number
    // Pattern: "Phone: (231)373-6341 Michael J Cebulski"
    if (!donorNameMatch) {
      donorNameMatch = text.match(/Phone:\s*\(\d{3}\)\d{3}-\d{4}\s+([A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+)/i)
    }

    // Strategy 3: Look for name after "Charlevoix" city name
    if (!donorNameMatch) {
      donorNameMatch = text.match(/Charlevoix[^A-Z]+([A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+)/i)
    }

    if (donorNameMatch) {
      result.donorName = donorNameMatch[1].trim()
      result.extractedFields.push('donorName')
    }

    // Extract collection date
    // pdf2json puts time first, then date
    // Pattern: "10:47 PM 09/22/2025" or "09/22/2025 10:47 PM"
    let collectedMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)

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
    for (const [pdfName, systemValue] of Object.entries(substanceMapping)) {
      // Create pattern to find substance name followed by "Negative" or nothing
      // We're looking for lines like: "Amphetamines   Negative   CIA   500 ng/mL"
      // The pattern looks for the substance name, then checks if "Negative" appears before "CIA"
      const pattern = new RegExp(
        `${escapeRegex(pdfName)}[\\s\\S]{0,200}(Negative|Positive)`,
        'i'
      )

      const match = text.match(pattern)
      if (match && match[1].toLowerCase() === 'positive') {
        result.detectedSubstances.push(systemValue)
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
    throw new Error(`Failed to extract 15-panel instant test data: ${error.message}`)
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
