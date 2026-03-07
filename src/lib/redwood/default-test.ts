import type { Payload } from 'payload'

type RedwoodDefaultTestDoc = {
  id?: string
  label?: string | null
  value?: string | null
  category?: string | null
  redwoodLabTestCode?: string | null
}

export type RedwoodEligibleDefaultTest =
  | {
      kind: 'eligible'
      redwoodLabTestCode: string
      testTypeId?: string
      testTypeLabel?: string
      testTypeValue?: string
    }
  | {
      kind: 'skip'
      reason: string
    }
  | {
      kind: 'error'
      reason: string
    }

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDefaultTestDoc(value: unknown): RedwoodDefaultTestDoc | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  return {
    id: normalizeText(record.id),
    label: normalizeText(record.label) || null,
    value: normalizeText(record.value) || null,
    category: normalizeText(record.category) || null,
    redwoodLabTestCode: normalizeText(record.redwoodLabTestCode) || null,
  }
}

export function resolveRedwoodEligibleDefaultTestFromDoc(testType: RedwoodDefaultTestDoc | null): RedwoodEligibleDefaultTest {
  if (!testType) {
    return {
      kind: 'skip',
      reason: 'Client does not have a default test type.',
    }
  }

  if (testType.category !== 'lab') {
    return {
      kind: 'skip',
      reason: 'Redwood default tests only support lab test types.',
    }
  }

  if (!testType.redwoodLabTestCode) {
    return {
      kind: 'error',
      reason: `Lab test type "${testType.label || testType.value || testType.id || 'unknown'}" is missing Redwood lab test code mapping.`,
    }
  }

  return {
    kind: 'eligible',
    redwoodLabTestCode: testType.redwoodLabTestCode,
    testTypeId: testType.id || undefined,
    testTypeLabel: testType.label || undefined,
    testTypeValue: testType.value || undefined,
  }
}

export async function resolveClientRedwoodEligibleDefaultTest(args: {
  client: {
    defaultTestType?: unknown
  }
  payload: Payload
}): Promise<RedwoodEligibleDefaultTest> {
  const { client, payload } = args
  const defaultTestType = client.defaultTestType

  const populated = normalizeDefaultTestDoc(defaultTestType)
  if (populated?.category || populated?.redwoodLabTestCode || populated?.label || populated?.value) {
    return resolveRedwoodEligibleDefaultTestFromDoc(populated)
  }

  const testTypeId =
    typeof defaultTestType === 'string'
      ? defaultTestType.trim()
      : defaultTestType && typeof defaultTestType === 'object' && 'id' in defaultTestType && typeof defaultTestType.id === 'string'
        ? defaultTestType.id.trim()
        : ''

  if (!testTypeId) {
    return {
      kind: 'skip',
      reason: 'Client does not have a default test type.',
    }
  }

  try {
    const testTypeDoc = (await payload.findByID({
      collection: 'test-types',
      id: testTypeId,
      depth: 0,
      overrideAccess: true,
      select: {
        label: true,
        value: true,
        category: true,
        redwoodLabTestCode: true,
      },
    })) as RedwoodDefaultTestDoc

    return resolveRedwoodEligibleDefaultTestFromDoc(normalizeDefaultTestDoc(testTypeDoc))
  } catch (error) {
    return {
      kind: 'error',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
