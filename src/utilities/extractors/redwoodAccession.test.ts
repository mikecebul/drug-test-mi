import { describe, expect, it } from 'vitest'
import { findRedwoodAccession } from './redwoodAccession'

describe('Redwood report accession', () => {
  it('reads the accession next to its label on page one', () => {
    expect(findRedwoodAccession([
      { text: 'Accession #:\tab-123456\tCollected: 10/27/2026', page: 1 },
      { text: 'Agency: 310872', page: 1 },
      { text: 'Accession #: UNUSED123', page: 2 },
    ])).toBe('AB-123456')
  })

  it('leaves missing or conflicting accessions empty', () => {
    expect(findRedwoodAccession([{ text: 'Accession #: Collected: 10/27/2026', page: 1 }])).toBeNull()
    expect(findRedwoodAccession([
      { text: 'Accession No.: AB123456', page: 1 },
      { text: 'Accession #:\tCD123456', page: 1 },
    ])).toBeNull()
  })
})
