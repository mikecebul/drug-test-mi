import { describe, expect, test } from 'vitest'
import {
  collectionDateFromParts,
  collectionDateLabel,
  collectionDateParts,
  collectionDetailsSchema,
} from './collection-details'
import { collectionSchema } from './validators'

describe('lab collection details', () => {
  test('shows clinic date and time without seconds regardless of machine timezone', () => {
    expect(collectionDateLabel('2026-11-11T16:37:14.123Z')).toBe('11/11/2026 11:37 AM')
    expect(collectionDateParts('2026-11-11T16:37:14.123Z')).toEqual({ date: '2026-11-11', time: '11:37' })
    expect(collectionDateLabel('invalid')).toBe('Not set')
  })
  test('does not change the recorded timestamp when only the test type is edited', () => {
    const original = '2026-11-11T16:37:14.123Z'
    expect(collectionDateFromParts('2026-11-11', '11:37', original)).toBe(original)
  })
  test('converts date edits with the clinic winter and summer offsets', () => {
    expect(collectionDateFromParts('2026-11-11', '11:37')).toBe('2026-11-11T16:37:00.000Z')
    expect(collectionDateFromParts('2026-07-11', '11:37')).toBe('2026-07-11T15:37:00.000Z')
  })
  test.each([
    ['2026-02-30', '11:37'],
    ['2026-11-11', '24:00'],
    ['2026-03-08', '02:30'],
    ['', '11:37'],
    ['2026-11-11', ''],
  ])('rejects impossible or missing input %s %s', (date, time) => {
    expect(collectionDetailsSchema.safeParse({ testType: '11-panel-lab', date, time }).success).toBe(false)
  })
  test('retains the selected-PBT requirement and accepts a zero result', () => {
    const values = {
      testType: '11-panel-lab',
      collectionDate: '2026-11-11T16:37:00Z',
      breathalyzerTaken: true,
      breathalyzerResult: null as number | null,
    }
    expect(collectionSchema.shape.collection.safeParse(values).success).toBe(false)
    expect(collectionSchema.shape.collection.safeParse({ ...values, breathalyzerResult: 0 }).success).toBe(true)
    expect(collectionSchema.shape.collection.safeParse({ ...values, breathalyzerTaken: false }).success).toBe(true)
  })
})
