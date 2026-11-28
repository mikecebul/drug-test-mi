import type { PositionedTextLine } from './pdfText'

export function normalizeRedwoodAccession(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const accession = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{3,23}$/.test(accession) && /\d/.test(accession) ? accession : null
}

type AccessionLine = Pick<PositionedTextLine, 'text' | 'page'> & Partial<Pick<PositionedTextLine, 'items'>>

export function findRedwoodAccession(lines: AccessionLine[]): string | null {
  const accessions = new Set<string>()
  const firstPage = lines.filter(({ page }) => page === 1)
  const items = firstPage.flatMap((line) => line.items ?? [])
  const textRuns = [...items.map(({ text }) => text), ...firstPage.filter((line) => !line.items?.length).map(({ text }) => text)]

  for (const text of textRuns) {
    const fields = text.matchAll(/\bAccession\s*(?:#|No\.?|Number)\s*:\s*([A-Z0-9-]+)(?=\s|$)/gi)
    for (const [, value] of fields) {
      const accession = normalizeRedwoodAccession(value)
      if (accession) accessions.add(accession)
    }
  }

  for (const label of items.filter(({ text }) => /^Accession\s*(?:#|No\.?|Number)\s*:\s*$/i.test(text))) {
    // Some Redwood PDFs place the value on a slightly lower PDF text baseline. Use the
    // items' coordinates so adjacent requisition and address fields are not mistaken for it.
    const rowTolerance = Math.max(2, label.height / 2)
    for (const item of items) {
      if (
        Math.abs(item.y - label.y) <= rowTolerance &&
        item.x >= label.x + label.width - 1 && item.x <= label.x + 136
      ) {
        const accession = normalizeRedwoodAccession(item.text)
        if (accession) accessions.add(accession)
      }
    }
  }
  return accessions.size === 1 ? [...accessions][0] : null
}
