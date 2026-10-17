import { describe, expect, test } from 'vitest'
import { getReportClientMatch, getReportClientMismatchKey } from '../reportClientMatch'

describe('getReportClientMatch', () => {
  test('matches selected client when report includes middle initial', () => {
    const result = getReportClientMatch('Michael J Cebulski', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('match')
  })

  test('requires review for a common first name variation even when the last name matches', () => {
    const result = getReportClientMatch('Mike Cebulski', {
      firstName: 'Michael',
      middleInitial: 'J',
      lastName: 'Cebulski',
    })

    expect(result.status).toBe('warning')
    expect(result.requiresConfirmation).toBe(true)
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
    expect(result.requiresConfirmation).toBe(true)
  })

  const client = { id: 'client-a', firstName: 'Alex', lastName: 'Morgan', dob: '1990-01-14T12:00:00.000Z' }

  test('compares birth dates as calendar dates without shifting the stored timestamp', () => {
    const result = getReportClientMatch('ALEX MORGAN', client, '01/14/1990')
    expect(result.status).toBe('match')
    expect(result.dobDifferent).toBe(false)
    expect(result.requiresConfirmation).toBe(false)
    expect(getReportClientMismatchKey(result)).toBeNull()
  })

  test('identifies a one-day DOB difference even with an exact name', () => {
    const result = getReportClientMatch('Alex Morgan', client, '01/15/1990')
    expect(result.status).toBe('mismatch')
    expect(result.nameDifferent).toBe(false)
    expect(result.dobDifferent).toBe(true)
    expect(result.reportDob).toBe('01/15/1990')
    expect(result.requiresConfirmation).toBe(true)
  })

  test('flags a high-scoring surname typo instead of treating it as an exact match', () => {
    const result = getReportClientMatch('Alex Morgon', client, '01/14/1990')
    expect(result.nameDifferent).toBe(true)
    expect(result.dobDifferent).toBe(false)
    expect(result.requiresConfirmation).toBe(true)
  })

  test.each(['Alex John Morgan', 'Alex J Riley Morgan', 'Alex J Morgan Jr'])(
    'does not silently ignore extra identity information (%s)',
    (name) => {
      const result = getReportClientMatch(name, { ...client, middleInitial: 'J' }, '01/14/1990')
      expect(result.nameDifferent).toBe(true)
      expect(result.requiresConfirmation).toBe(true)
    },
  )

  test('does not discard accented letters when comparing names', () => {
    const result = getReportClientMatch('José Morgan', { ...client, firstName: 'Jos' }, '01/14/1990')
    expect(result.nameDifferent).toBe(true)
    expect(result.requiresConfirmation).toBe(true)
  })

  test('identifies both name and birth date differences', () => {
    const result = getReportClientMatch('Alex Morgon', client, '01/15/1990')
    expect(result.nameDifferent).toBe(true)
    expect(result.dobDifferent).toBe(true)
  })

  test.each([undefined, null, ''])('does not invent a DOB mismatch when it is absent from the PDF (%s)', (dob) => {
    const result = getReportClientMatch('Alex Morgan', client, dob)
    expect(result.status).toBe('match')
    expect(result.reportDob).toBeNull()
    expect(result.dobDifferent).toBe(false)
  })

  test.each(['02/30/1990', 'unreadable'])('requires review for an invalid report DOB (%s)', (dob) => {
    const result = getReportClientMatch('Alex Morgan', client, dob)
    expect(result.reportDob).toBeNull()
    expect(result.requiresConfirmation).toBe(true)
  })

  test('requires review when a report DOB cannot be compared with a missing client DOB', () => {
    const result = getReportClientMatch('Alex Morgan', { ...client, dob: null }, '01/14/1990')
    expect(result.clientDob).toBeNull()
    expect(result.requiresConfirmation).toBe(true)
  })

  test('invalidates acknowledgement for a changed DOB or a different same-name client', () => {
    const original = getReportClientMismatchKey(getReportClientMatch('Alex Morgon', client, '01/15/1990'))
    expect(original).toBeTruthy()
    for (const changed of [
      getReportClientMatch('Alex Morgon', client, '01/16/1990'),
      getReportClientMatch('Alex Morgon', { ...client, dob: '01/13/1990' }, '01/15/1990'),
      getReportClientMatch('Alex Morgon', { ...client, id: 'client-b' }, '01/15/1990'),
    ])
      expect(getReportClientMismatchKey(changed)).not.toBe(original)
  })
})
