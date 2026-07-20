import { describe, expect, it } from 'vitest'

import {
  buildRedwoodDonorCandidates,
  selectBestRedwoodDonorCandidate,
  type RedwoodDonorTableRow,
} from '@/lib/redwood/donor-search'

const client = {
  firstName: 'Michael',
  lastName: 'Cebulski',
  middleInitial: 'A',
}

describe('redwood donor search helpers', () => {
  it('falls back to the best DOB-verified candidate when unique ID is not present', () => {
    const rows: RedwoodDonorTableRow[] = [
      { rowIndex: 0, cells: ['Cebulski, Michael A', '310974', 'RWD0002', '01/01/1990'] },
      { rowIndex: 1, cells: ['Cebulski, Michelle A', '310974', 'RWD0003', '01/02/1990'] },
    ]

    const candidates = buildRedwoodDonorCandidates(rows, '310974', client)
    const selected = selectBestRedwoodDonorCandidate(candidates, '1990-01-01')

    expect(selected.rowIndex).toBe(0)
    expect(selected.displayName).toBe('Cebulski, Michael')
  })

  it('throws when multiple DOB-verified candidates are ambiguous', () => {
    const rows: RedwoodDonorTableRow[] = [
      { rowIndex: 0, cells: ['Cebulski, Michael A', '310974', 'RWD0001', '01/01/1990'] },
      { rowIndex: 1, cells: ['Cebulski, Michael A', '310974', 'RWD0002', '01/01/1990'] },
    ]

    const candidates = buildRedwoodDonorCandidates(rows, '310974', client)

    expect(() => selectBestRedwoodDonorCandidate(candidates, '1990-01-01')).toThrow('ambiguous')
  })

  it('requires a confident name match even when the surname and DOB match', () => {
    const rows: RedwoodDonorTableRow[] = [
      { rowIndex: 0, cells: ['Cebulski, Jennifer', '310974', 'RWD0001', '01/01/1990'] },
    ]

    const candidates = buildRedwoodDonorCandidates(rows, '310974', client)

    expect(() => selectBestRedwoodDonorCandidate(candidates, '1990-01-01')).toThrow('manual review required')
  })

  it('filters out rows from disallowed Redwood accounts', () => {
    const rows: RedwoodDonorTableRow[] = [
      { rowIndex: 0, cells: ['Cebulski, Michael A', '310974', 'RWD0001', '01/01/1990'] },
      { rowIndex: 1, cells: ['Cebulski, Michael A', '310872', 'RWD0002', '01/01/1990'] },
    ]

    const candidates = buildRedwoodDonorCandidates(rows, '310974', client)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.rowIndex).toBe(0)
  })
})
