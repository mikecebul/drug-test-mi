import { describe, expect, test } from 'vitest'
import { groupCourtSelectOptions } from '../groupCourtSelectOptions'
import type { CourtOption } from '../../types/recipient-types'

function buildCourt(id: string, name: string): CourtOption {
  return {
    id,
    name,
    contacts: [{ email: `${id}@example.com` }],
    recipientEmails: [`${id}@example.com`],
  }
}

describe('groupCourtSelectOptions', () => {
  test('groups Charlevoix and Emmet courts by prefix and sends non-matches to Other Courts', () => {
    const options = groupCourtSelectOptions([
      buildCourt('1', 'Wayne County Court'),
      buildCourt('2', 'Emmet District Court'),
      buildCourt('3', 'Charlevoix Circuit Court'),
    ])

    expect(options).toEqual([
      {
        groupLabel: 'Charlevoix',
        options: [{ id: '3', label: 'Charlevoix Circuit Court', value: '3' }],
      },
      {
        groupLabel: 'Emmet',
        options: [{ id: '2', label: 'Emmet District Court', value: '2' }],
      },
      {
        groupLabel: 'Other Courts',
        options: [{ id: '1', label: 'Wayne County Court', value: '1' }],
      },
      {
        label: 'Other (Add new court)',
        value: 'other',
      },
    ])
  })

  test('matches prefixes case-insensitively', () => {
    const options = groupCourtSelectOptions([
      buildCourt('1', 'charlevoix District'),
      buildCourt('2', 'EMMET Juvenile'),
    ])

    expect(options).toEqual([
      {
        groupLabel: 'Charlevoix',
        options: [{ id: '1', label: 'charlevoix District', value: '1' }],
      },
      {
        groupLabel: 'Emmet',
        options: [{ id: '2', label: 'EMMET Juvenile', value: '2' }],
      },
      {
        label: 'Other (Add new court)',
        value: 'other',
      },
    ])
  })

  test('sorts options alphabetically within each group and keeps Other as final item', () => {
    const options = groupCourtSelectOptions([
      buildCourt('1', 'Charlevoix Youth Court'),
      buildCourt('2', 'Charlevoix Circuit Court'),
      buildCourt('3', 'Otsego District Court'),
      buildCourt('4', 'Alpena District Court'),
    ])

    expect(options[0]).toEqual({
      groupLabel: 'Charlevoix',
      options: [
        { id: '2', label: 'Charlevoix Circuit Court', value: '2' },
        { id: '1', label: 'Charlevoix Youth Court', value: '1' },
      ],
    })
    expect(options[1]).toEqual({
      groupLabel: 'Other Courts',
      options: [
        { id: '4', label: 'Alpena District Court', value: '4' },
        { id: '3', label: 'Otsego District Court', value: '3' },
      ],
    })
    expect(options[2]).toEqual({
      label: 'Other (Add new court)',
      value: 'other',
    })
  })
})
