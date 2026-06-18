import { describe, expect, test } from 'vitest'
import { getReportClientMatch } from '../reportClientMatch'

describe('getReportClientMatch', () => {
  test('matches selected client when report includes middle initial', () => {
    const result = getReportClientMatch('Michael J Cebulski', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('match')
  })

  test('allows common first name variation when last name matches', () => {
    const result = getReportClientMatch('Mike Cebulski', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('match')
  })

  test('flags a different first name with same last name as mismatch', () => {
    const result = getReportClientMatch('Bob Cebulski', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('mismatch')
  })

  test('shows a warning for a likely last-name typo', () => {
    const result = getReportClientMatch('John Mosely', {
      firstName: 'John',
      lastName: 'Mosley',
    })

    expect(result.status).toBe('warning')
  })

  test('flags a different last name as mismatch', () => {
    const result = getReportClientMatch('Michael Smith', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('mismatch')
  })

  test('returns unknown when report name cannot be parsed', () => {
    const result = getReportClientMatch(null, {
      firstName: 'Michael',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('unknown')
  })
})
