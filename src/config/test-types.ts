export type TestTypeCategory = 'instant' | 'lab'

export type TestTypeConfig = {
  value: string
  label: string
  bookingLabel: string
  category: TestTypeCategory
  price: number
  toxAccessCode: string | null
  isActive: boolean
  /** Cal.com select/input answer spellings for explicit test-type questions. */
  calcomAliases: readonly string[]
  /** Cal.com event type slugs where the event itself implies the test type. */
  calcomEventSlugs: readonly string[]
}

export const TEST_TYPES = [
  {
    value: '17-panel-instant',
    label: '17-Panel Instant',
    bookingLabel: '17 Panel Instant',
    category: 'instant',
    price: 35,
    toxAccessCode: null,
    isActive: true,
    calcomAliases: ['17 Panel Instant', '17-Panel Instant', 'Instant 17 Panel'],
    calcomEventSlugs: ['instant-17-panel'],
  },
  {
    value: '11-panel-lab',
    label: '11-Panel Lab',
    bookingLabel: '11 Panel Lab',
    category: 'lab',
    price: 40,
    toxAccessCode: 'B729',
    isActive: true,
    calcomAliases: ['11 Panel Lab', '11-Panel Lab'],
    calcomEventSlugs: ['11-panel-lab-screen'],
  },
  {
    value: '11-panel-lab-no-etg',
    label: '11-Panel Lab (no EtG)',
    bookingLabel: '11 Panel Lab (no EtG)',
    category: 'lab',
    price: 40,
    toxAccessCode: 'B829',
    isActive: true,
    calcomAliases: ['11 Panel Lab no EtG', '11-Panel Lab no EtG', '11 Panel no EtG Lab', '11 Panel no EtG'],
    calcomEventSlugs: [],
  },
  {
    value: '8-panel-lab',
    label: '8-Panel Lab',
    bookingLabel: '8 Panel Lab',
    category: 'lab',
    price: 40,
    toxAccessCode: 'B814',
    isActive: true,
    calcomAliases: ['8 Panel Lab', '8-Panel Lab', 'Harbor Industries Drug Test Booking'],
    calcomEventSlugs: ['harbor-industries-drug-test-booking'],
  },
  {
    value: '17-panel-sos-lab',
    label: '17-Panel SOS Lab',
    bookingLabel: '17 SOS Lab',
    category: 'lab',
    price: 45,
    toxAccessCode: null,
    isActive: true,
    calcomAliases: ['17 SOS Lab', '17-Panel SOS Lab', '17 Panel SOS Lab', '17 Panel Lab'],
    calcomEventSlugs: ['sos-17-panel-lab-screen'],
  },
  {
    value: 'etg-lab',
    label: 'EtG Lab',
    bookingLabel: 'EtG Lab',
    category: 'lab',
    price: 40,
    toxAccessCode: null,
    isActive: true,
    calcomAliases: ['EtG Lab', 'EtG'],
    calcomEventSlugs: ['etg-lab-screen'],
  },
  {
    value: '15-panel-instant',
    label: '15-Panel Instant',
    bookingLabel: '15 Panel Instant',
    category: 'instant',
    price: 35,
    toxAccessCode: null,
    isActive: false,
    calcomAliases: ['15 Panel Instant', '15-Panel Instant'],
    calcomEventSlugs: [],
  },
] as const satisfies readonly TestTypeConfig[]

export type TestTypeValue = (typeof TEST_TYPES)[number]['value']
export type ActiveTestType = Extract<(typeof TEST_TYPES)[number], { isActive: true }>
export type ActiveTestTypeValue = ActiveTestType['value']
export type LabTestTypeValue = Extract<(typeof TEST_TYPES)[number], { category: 'lab' }>['value']

export type GuidedTestType = {
  id: TestTypeValue
  label: string
  value: TestTypeValue
  category: TestTypeCategory
  price: number
  toxAccessCode: string | null
}

type TestTypeMatchCandidate = {
  bookingLabel?: string | null
  label?: string | null
  value?: string | null
  calcomAliases?: readonly string[] | null
  calcomEventSlugs?: readonly string[] | null
}

const testTypesByValue = new Map(TEST_TYPES.map((testType) => [testType.value, testType]))
const calcomAliasesByValue = new Map(
  TEST_TYPES.map((testType) => [testType.value, [...testType.calcomAliases, ...testType.calcomEventSlugs]]),
)
const testTypeValues = new Set(TEST_TYPES.map((testType) => testType.value))
const labTestTypeValues = new Set(
  TEST_TYPES.filter((testType) => testType.category === 'lab').map((testType) => testType.value),
)

export const ACTIVE_TEST_TYPES = TEST_TYPES.filter((testType) => testType.isActive)

export const activeTestTypeSelectOptions = ACTIVE_TEST_TYPES.map((testType) => ({
  label: testType.label,
  value: testType.value,
}))

export const testTypeSelectOptions = TEST_TYPES.map((testType) => ({
  label: testType.isActive ? testType.label : `${testType.label} (Legacy)`,
  value: testType.value,
}))

export const activeTestTypeBookingOptions = ACTIVE_TEST_TYPES.map((testType) => ({
  id: testType.value,
  value: testType.value,
  label: testType.bookingLabel,
}))

export function isTestTypeValue(value: unknown): value is TestTypeValue {
  return typeof value === 'string' && testTypeValues.has(value as TestTypeValue)
}

export function isLabTestTypeValue(value: unknown): value is LabTestTypeValue {
  return typeof value === 'string' && labTestTypeValues.has(value as LabTestTypeValue)
}

export function getTestTypeByValue(value: unknown) {
  return isTestTypeValue(value) ? testTypesByValue.get(value) || null : null
}

export function getActiveTestTypes(): GuidedTestType[] {
  return ACTIVE_TEST_TYPES.map(mapConfiguredTestType)
}

export function mapConfiguredTestType(testType: (typeof TEST_TYPES)[number]): GuidedTestType {
  return {
    id: testType.value,
    label: testType.label,
    value: testType.value,
    category: testType.category,
    price: testType.price,
    toxAccessCode: testType.toxAccessCode,
  }
}

export function getTestTypeLabel(value: unknown): string | undefined {
  return getTestTypeByValue(value)?.label
}

export function getTestTypeBookingLabel(value: unknown): string | undefined {
  return getTestTypeByValue(value)?.bookingLabel
}

export function extractTestTypeValue(testType: unknown): TestTypeValue | undefined {
  if (isTestTypeValue(testType)) return testType

  if (testType && typeof testType === 'object' && 'value' in testType) {
    const value = (testType as { value?: unknown }).value
    if (isTestTypeValue(value)) return value
  }

  return undefined
}

export function mapTestTypeValue(testType: unknown): GuidedTestType | null {
  const value = extractTestTypeValue(testType)
  const config = getTestTypeByValue(value)
  return config ? mapConfiguredTestType(config) : null
}

export function normalizeCalcomTestTypeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function getCalcomTestTypeMatchValues(testType: TestTypeMatchCandidate) {
  const configuredAliases =
    typeof testType.value === 'string' ? calcomAliasesByValue.get(testType.value as TestTypeValue) || [] : []
  const values = [
    testType.bookingLabel,
    testType.label,
    testType.value,
    ...configuredAliases,
    ...(testType.calcomAliases || []),
    ...(testType.calcomEventSlugs || []),
  ]

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        .map(normalizeCalcomTestTypeText),
    ),
  )
}

export function matchesCalcomScheduledTestType(testType: TestTypeMatchCandidate, scheduledTestAnswer: string) {
  const expectedValue = normalizeCalcomTestTypeText(scheduledTestAnswer)
  if (!expectedValue) return false

  const matchValues = getCalcomTestTypeMatchValues(testType)
  return (
    matchValues.includes(expectedValue) ||
    matchValues.some((matchValue) => matchValue.length >= 6 && expectedValue.includes(matchValue))
  )
}

export function findCalcomScheduledTestTypeMatch<T extends TestTypeMatchCandidate>(
  testTypes: readonly T[],
  scheduledTestAnswer: string,
) {
  const expectedValue = normalizeCalcomTestTypeText(scheduledTestAnswer)
  if (!expectedValue) return null

  const exactMatches = testTypes.filter((testType) => getCalcomTestTypeMatchValues(testType).includes(expectedValue))
  if (exactMatches.length > 0) return exactMatches.length === 1 ? exactMatches[0] : null

  const containedMatches = testTypes
    .map((testType) => {
      const longestMatch = Math.max(
        0,
        ...getCalcomTestTypeMatchValues(testType)
          .filter((matchValue) => matchValue.length >= 6 && expectedValue.includes(matchValue))
          .map((matchValue) => matchValue.length),
      )

      return { testType, longestMatch }
    })
    .filter((match) => match.longestMatch > 0)

  const bestMatchLength = Math.max(0, ...containedMatches.map((match) => match.longestMatch))
  const bestMatches = containedMatches.filter((match) => match.longestMatch === bestMatchLength)

  return bestMatches.length === 1 ? bestMatches[0].testType : null
}

export function findConfiguredTestTypeByCalcomAnswer(scheduledTestAnswer: string) {
  return findCalcomScheduledTestTypeMatch(TEST_TYPES, scheduledTestAnswer)
}
