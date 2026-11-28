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

  it('matches the accession value on a nearby baseline in the same columns', () => {
    const entry = (text: string, x: number, y: number, width: number) => ({ text, x, y, width, height: 8.2, page: 1 })
    const lines = [
      {
        page: 1, text: 'Requisition #: 1000001245',
        items: [entry('Requisition #:', 220.5, 681.85, 46), entry('1000001245', 313.5, 681.85, 42)],
      },
      {
        page: 1, text: 'Collected by:\tAccession #:\tExample, MI 49720',
        items: [entry('Accession #:', 220.5, 669.85, 41.5), entry('49720', 438, 669.85, 16)],
      },
      { page: 1, text: '260304-00123', items: [entry('260304-00123', 313.5, 669.35, 48)] },
    ]
    expect(findRedwoodAccession(lines)).toBe('260304-00123')
    expect(findRedwoodAccession(lines.slice(0, 2))).toBeNull()
  })
})
