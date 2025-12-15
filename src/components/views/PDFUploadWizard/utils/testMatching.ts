import { format } from 'date-fns'
import { calculateNameSimilarity } from './calculateSimilarity'

export interface DrugTest {
  id: string
  clientName: string
  testType: string
  collectionDate: string
  screeningStatus: string
  clientHeadshot?: string | null
}

export interface TestMatchResult {
  test: DrugTest
  score: number
}

export type TestType = '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'

/**
 * Parse a full name into first, middle, and last name components
 */
function parseName(fullName: string): { first: string; middle?: string; last: string } {
  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 1) {
    return { first: '', last: parts[0] }
  }

  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] }
  }

  // 3+ parts: first name, middle initial(s), last name
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  }
}

/**
 * Filter tests by screening status
 * For screen workflows, exclude already screened tests
 */
export function filterByScreeningStatus(
  tests: DrugTest[],
  isScreenWorkflow: boolean,
): DrugTest[] {
  if (!isScreenWorkflow) {
    return tests
  }

  // For screen workflows, only show tests that haven't been screened yet
  return tests.filter(test =>
    test.screeningStatus !== 'screened' &&
    test.screeningStatus !== 'complete'
  )
}

/**
 * Filter tests by test type to match the uploaded PDF type
 */
export function filterByTestType(
  tests: DrugTest[],
  uploadedTestType?: TestType,
): DrugTest[] {
  if (!uploadedTestType) {
    return tests
  }

  // Map uploaded test types to database test type values
  // Database stores the value (e.g., '11-panel-lab'), not the label (e.g., '11-Panel Lab')
  const testTypeMap: Record<TestType, string[]> = {
    '15-panel-instant': ['15-panel-instant'],
    '11-panel-lab': ['11-panel-lab'],
    '17-panel-sos-lab': ['17-panel-sos-lab'],
    'etg-lab': ['etg-lab'],
  }

  const validTestTypes = testTypeMap[uploadedTestType] || []

  if (validTestTypes.length === 0) {
    return tests
  }

  return tests.filter(test => validTestTypes.includes(test.testType))
}

/**
 * Calculate match score for a single test
 * Uses weighted name similarity (60 points max) and date matching (40 points max)
 */
export function calculateTestMatchScore(
  extractedName: string | null,
  extractedDate: string | null, // Now accepts ISO string instead of Date
  test: DrugTest,
): number {
  let score = 0

  // Name matching (60 points max) using weighted similarity
  if (extractedName) {
    const extractedParsed = parseName(extractedName)
    const testParsed = parseName(test.clientName)

    // Calculate similarity using the weighted name similarity function
    const similarity = calculateNameSimilarity(
      extractedParsed.first,
      extractedParsed.last,
      testParsed.first,
      testParsed.last,
      extractedParsed.middle,
      testParsed.middle,
    )

    // Convert 0-1 similarity to 0-60 score
    score += similarity * 60
  }

  // Date matching (40 points max)
  if (extractedDate) {
    // extractedDate is now an ISO string, format it for comparison
    const extractedDateStr = format(new Date(extractedDate), 'yyyy-MM-dd')
    const testDateStr = test.collectionDate.split('T')[0]

    if (extractedDateStr === testDateStr) {
      score += 40 // Exact date match
    } else {
      // Check if within a few days
      const daysDiff = Math.abs(
        (new Date(extractedDateStr).getTime() - new Date(testDateStr).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      if (daysDiff <= 1) {
        score += 30 // Within 1 day
      } else if (daysDiff <= 3) {
        score += 20 // Within 3 days
      } else if (daysDiff <= 7) {
        score += 10 // Within a week
      }
    }
  }

  return Math.round(score)
}

/**
 * Get ranked test matches with filtering and scoring
 *
 * @param tests - All available pending tests
 * @param extractedName - Name extracted from PDF
 * @param extractedDate - Date extracted from PDF
 * @param uploadedTestType - Type of test from uploaded PDF
 * @param isScreenWorkflow - Whether this is a screen workflow (filters out already screened tests)
 * @returns Sorted array of test matches with scores
 */
export function getRankedTestMatches(
  tests: DrugTest[],
  extractedName: string | null,
  extractedDate: string | null, // Now accepts ISO string instead of Date
  uploadedTestType?: TestType,
  isScreenWorkflow: boolean = false,
): TestMatchResult[] {
  // Apply filters
  let filteredTests = tests

  // Filter by screening status first
  filteredTests = filterByScreeningStatus(filteredTests, isScreenWorkflow)

  // Filter by test type if we have one
  filteredTests = filterByTestType(filteredTests, uploadedTestType)

  // Calculate scores for all filtered tests
  const testsWithScores = filteredTests.map((test) => ({
    test,
    score: calculateTestMatchScore(extractedName, extractedDate, test),
  }))

  // Sort by score descending
  testsWithScores.sort((a, b) => b.score - a.score)

  return testsWithScores
}
