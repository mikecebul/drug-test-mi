import type { PositionedTextLine } from './pdfText'

export function normalizeRedwoodAccession(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const accession = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{3,23}$/.test(accession) && /\d/.test(accession) ? accession : null
}

export function findRedwoodAccession(lines: Pick<PositionedTextLine, 'text' | 'page'>[]): string | null {
  const accessions = new Set<string>()
  for (const line of lines.filter(({ page }) => page === 1)) {
    const fields = line.text.matchAll(/\bAccession\s*(?:#|No\.?|Number)\s*:\s*([A-Z0-9-]+)(?=\s|$)/gi)
    for (const [, value] of fields) {
      const accession = normalizeRedwoodAccession(value)
      if (accession) accessions.add(accession)
    }
  }
  return accessions.size === 1 ? [...accessions][0] : null
}
