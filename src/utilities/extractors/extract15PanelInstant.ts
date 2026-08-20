import type { SubstanceValue } from '@/fields/substanceOptions'
import { TZDate } from '@date-fns/tz'
import { FULL_NAME_PATTERN, normalizeExtractedDonorName } from './donorName'
import {
  extractPositionedPdfText,
  findAnchoredLine,
  findAnchoredValue,
  normalizeSubstanceLabel,
  type PositionedTextLine,
} from './pdfText'

/**
 * Extracted data from 15-panel instant test PDF
 */
export interface Extracted15PanelData {
  testType: '15-panel-instant' | '17-panel-instant'
  donorName: string | null
  collectionDate: string | null // ISO string with timezone offset (or UTC Z)
  dob: string | null // Date of birth in MM/DD/YYYY format
  gender: string | null // M or F
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  confidenceReasons: string[]
  parseWarnings: string[]
  resultRowCount: number
  resultsComplete: boolean
  extractedFields: string[]
}

const INSTANT_SUBSTANCE_ALIASES: Array<{ aliases: string[]; value: SubstanceValue }> = [
  { aliases: ['6 monoacetylmorphine', '6 mam'], value: '6-mam' },
  { aliases: ['methylenedioxymethamphetamine', 'mdma'], value: 'mdma' },
  { aliases: ['methamphetamine'], value: 'methamphetamines' },
  { aliases: ['amphetamines'], value: 'amphetamines' },
  { aliases: ['benzodiazepines'], value: 'benzodiazepines' },
  { aliases: ['buprenorphine'], value: 'buprenorphine' },
  { aliases: ['barbiturates'], value: 'barbiturates' },
  { aliases: ['cocaine'], value: 'cocaine' },
  { aliases: ['etg', 'ethyl glucuronide'], value: 'etg' },
  { aliases: ['fentanyl'], value: 'fentanyl' },
  { aliases: ['kratom', 'mitragynine'], value: 'kratom' },
  { aliases: ['methadone'], value: 'methadone' },
  { aliases: ['morphine'], value: 'morphine' },
  { aliases: ['opiates'], value: 'opiates' },
  { aliases: ['oxycodone'], value: 'oxycodone' },
  { aliases: ['phencyclidine', 'pcp'], value: 'pcp' },
  { aliases: ['synthetic cannabinoids'], value: 'synthetic_cannabinoids' },
  { aliases: ['thc', 'marijuana'], value: 'thc' },
  { aliases: ['tramadol'], value: 'tramadol' },
]

function mapInstantSubstance(label: string): SubstanceValue | null {
  const normalized = normalizeSubstanceLabel(label)
  return (
    INSTANT_SUBSTANCE_ALIASES.find(({ aliases }) => aliases.some((alias) => normalized.includes(alias)))?.value ?? null
  )
}

function extractInstantScreenRows(lines: PositionedTextLine[]) {
  const rows = new Map<SubstanceValue, 'negative' | 'positive'>()

  for (const line of lines) {
    const methodIndex = line.items.findIndex((item) => /^CIA$/i.test(item.text))
    if (methodIndex < 0) continue

    const resultIndex = line.items.findIndex(
      (item, index) => index < methodIndex && /^(?:Negative|Presumptive Positive|Positive)$/i.test(item.text),
    )
    if (resultIndex <= 0) continue

    const substance = mapInstantSubstance(
      line.items
        .slice(0, resultIndex)
        .map((item) => item.text)
        .join(' '),
    )
    if (!substance) continue

    rows.set(substance, /positive/i.test(line.items[resultIndex].text) ? 'positive' : 'negative')
  }

  return rows
}

function calculateInstantConfidence(args: {
  donorName: string | null
  donorNameAnchored: boolean
  collectionDate: string | null
  collectionDateAnchored: boolean
  dob: string | null
  gender: string | null
  resultRowCount: number
  resultsComplete: boolean
}) {
  let score = 10 // Test type is always identified, with a conservative fallback.
  const reasons: string[] = ['test type identified']

  if (args.donorName) {
    score += args.donorNameAnchored ? 25 : 15
    reasons.push(
      args.donorNameAnchored ? 'donor name anchored to its label' : 'donor name identified by layout fallback',
    )
  }
  if (args.collectionDate) {
    score += args.collectionDateAnchored ? 25 : 15
    reasons.push(
      args.collectionDateAnchored
        ? 'collection date anchored to its label'
        : 'collection date identified by layout fallback',
    )
  }
  if (args.dob && args.gender) {
    score += 5
    reasons.push('DOB and sex anchored to their labels')
  }
  if (args.resultsComplete) {
    score += 35
    reasons.push(`${args.resultRowCount} screening rows matched by coordinates`)
  } else if (args.resultRowCount > 0) {
    score += 15
    reasons.push(`only ${args.resultRowCount} screening rows matched by coordinates`)
  }

  return {
    confidenceScore: Math.min(score, 100),
    confidence: score >= 85 ? ('high' as const) : score >= 60 ? ('medium' as const) : ('low' as const),
    confidenceReasons: reasons,
  }
}

export function extractInstantDonorName(text: string): string | null {
  const strategies = [
    new RegExp(String.raw`Phone:\s*\(\d{3}\)\d{3}-\d{4}\s*\n\s*(${FULL_NAME_PATTERN})`, 'iu'),
    new RegExp(String.raw`(${FULL_NAME_PATTERN})\s*\n\s*iCup\s+Urine`, 'iu'),
    new RegExp(String.raw`(${FULL_NAME_PATTERN})\s*\n\s*FFUO\s+-\s+17\s+Panel\s+Slim\s+Cup`, 'iu'),
    new RegExp(String.raw`Donor Signature\s*\n\s*(${FULL_NAME_PATTERN})`, 'iu'),
  ]

  for (const strategy of strategies) {
    const match = text.match(strategy)
    if (match?.[1]) {
      return normalizeExtractedDonorName(match[1])
    }
  }

  return null
}

/**
 * Extract data from an instant test PDF using positioned text from PDF.js.
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
    const document = await extractPositionedPdfText(buffer)
    const text = document.rawText

    // Initialize result object
    const result: Extracted15PanelData = {
      testType: /17\s+Panel\s+Slim\s+Cup/i.test(text) ? '17-panel-instant' : '15-panel-instant',
      donorName: null,
      collectionDate: null,
      dob: null,
      gender: null,
      detectedSubstances: [],
      isDilute: false,
      rawText: text,
      confidence: 'low',
      confidenceScore: 0,
      confidenceReasons: [],
      parseWarnings: [],
      resultRowCount: 0,
      resultsComplete: false,
      extractedFields: [],
    }

    result.extractedFields.push('testType')

    // Extract donor name
    // Older reports may omit the explicit donor label. Preserve the proven
    // text-layout fallbacks for those variants after trying the row anchor.
    // Pattern: "Phone: (231)373-6341\nDennis D Erfourth"

    const anchoredDonorName = findAnchoredValue(document.lines, /^Donor Name:$/i)
    result.donorName = anchoredDonorName
      ? normalizeExtractedDonorName(anchoredDonorName)
      : extractInstantDonorName(text)
    if (result.donorName) {
      result.extractedFields.push('donorName')
    }

    // Extract collection date
    // Collection date and time must come from the same anchored report row.
    const collectedLine = findAnchoredLine(document.lines, /^Collected:$/i)
    const collectedText = collectedLine?.items
      .slice(collectedLine.items.findIndex((item) => /^Collected:$/i.test(item.text)) + 1)
      .map((item) => item.text)
      .join(' ')
    let collectedMatch = collectedText?.match(/(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
    const collectionDateAnchored = Boolean(collectedMatch)

    if (collectedMatch) {
      const dateStr = collectedMatch[1]
      const timeStr = collectedMatch[2]

      // Parse as EST/EDT timezone
      const parsed = parseDateTimeInEST(dateStr, timeStr)

      if (parsed && !isNaN(parsed.getTime())) {
        // Return ISO string instead of Date object to avoid serialization issues
        result.collectionDate = parsed.toISOString()
        result.extractedFields.push('collectionDate')
      }
    } else {
      // Fallback: Try standard format
      collectedMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
      if (collectedMatch) {
        const dateStr = collectedMatch[1]
        const timeStr = collectedMatch[2]

        // Parse as EST/EDT timezone
        const parsed = parseDateTimeInEST(dateStr, timeStr)

        if (parsed && !isNaN(parsed.getTime())) {
          // Return ISO string instead of Date object to avoid serialization issues
          result.collectionDate = parsed.toISOString()
          result.extractedFields.push('collectionDate')
        }
      }
    }

    // Extract DOB and Gender
    // Pattern in PDF: "DOB:\nSex:\n03/13/1982\nM" or "DOB:\nSex:\n03/13/1982M"
    // The DOB and Sex labels are on separate lines, followed by their values

    // Strategy 1: Try combined pattern (DOB:Sex: followed by date and gender)
    const anchoredDob = findAnchoredValue(document.lines, /^DOB:$/i, /^\d{1,2}\/\d{1,2}\/\d{4}$/)
    const anchoredGender = findAnchoredValue(document.lines, /^Sex:$/i, /^[MF]$/i)
    let dobSexMatch = text.match(/DOB:\s*\n?\s*Sex:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\n?\s*([MF])/i)

    // Strategy 2: Try date+gender on same line (e.g., "03/13/1982M")
    if (!dobSexMatch) {
      dobSexMatch = text.match(/DOB:\s*\n?\s*Sex:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})([MF])/i)
    }

    if (anchoredDob || anchoredGender) {
      result.dob = anchoredDob
      result.gender = anchoredGender?.toUpperCase() ?? null
      if (result.dob) result.extractedFields.push('dob')
      if (result.gender) result.extractedFields.push('gender')
    } else if (dobSexMatch) {
      result.dob = dobSexMatch[1]
      result.gender = dobSexMatch[2].toUpperCase()
      result.extractedFields.push('dob')
      result.extractedFields.push('gender')
    } else {
      // Fallback: Try to extract DOB and Sex separately
      const dobMatch = text.match(/DOB:\s*[\n\t]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dobMatch) {
        result.dob = dobMatch[1]
        result.extractedFields.push('dob')
      }

      const sexMatch = text.match(/Sex:\s*[\n\t]\s*([MF])/i)
      if (sexMatch) {
        result.gender = sexMatch[1].toUpperCase()
        result.extractedFields.push('gender')
      }
    }

    // Require a result phrase rather than a glossary/disclaimer mention.
    if (/\b(?:specimen is dilute|dilute specimen)\b/i.test(text)) {
      result.isDilute = true
      result.extractedFields.push('isDilute')
    }

    const screenRows = extractInstantScreenRows(document.lines)
    result.resultRowCount = screenRows.size
    const expectedRowCount = result.testType === '17-panel-instant' ? 17 : 15
    result.resultsComplete = result.resultRowCount >= expectedRowCount
    result.detectedSubstances = [...screenRows.entries()]
      .filter(([, status]) => status === 'positive')
      .map(([substance]) => substance)

    if (screenRows.size > 0) {
      result.extractedFields.push('detectedSubstances')
    }

    if (!result.resultsComplete) {
      result.parseWarnings.push(
        `Only ${result.resultRowCount} of ${expectedRowCount} expected screening rows were identified; verify every result manually.`,
      )
    }

    const confidence = calculateInstantConfidence({
      ...result,
      donorNameAnchored: Boolean(anchoredDonorName),
      collectionDateAnchored,
    })
    result.confidence = confidence.confidence
    result.confidenceScore = confidence.confidenceScore
    result.confidenceReasons = confidence.confidenceReasons

    return result
  } catch (error) {
    throw new Error(
      `Failed to extract 15-panel instant test data: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
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
