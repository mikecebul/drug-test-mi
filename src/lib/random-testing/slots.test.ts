import { describe, expect, test } from 'vitest'

import {
  findEarliestRandomTestingSlot,
  formatRandomTestingTime,
  getRandomTestingAssignedTimes,
  getRandomTestingSlotCapacity,
} from './slots'

describe('random-testing slots', () => {
  test('assigns the first weekday and weekend times in ten-minute increments', () => {
    expect(getRandomTestingAssignedTimes(0)).toEqual({ weekday: '18:00', weekend: '10:50' })
    expect(getRandomTestingAssignedTimes(1)).toEqual({ weekday: '18:10', weekend: '11:00' })
  })

  test('reuses the earliest released slot', () => {
    expect(findEarliestRandomTestingSlot([0, 2, 3])).toBe(1)
  })

  test('uses weekend availability as the initial capacity limit', () => {
    expect(getRandomTestingSlotCapacity()).toBe(4)
    expect(() => findEarliestRandomTestingSlot([0, 1, 2, 3])).toThrow('All 4 random-testing slots')
  })

  test('formats stored times for the client dashboard', () => {
    expect(formatRandomTestingTime('18:10')).toBe('6:10 PM')
    expect(formatRandomTestingTime('10:50')).toBe('10:50 AM')
  })
})
