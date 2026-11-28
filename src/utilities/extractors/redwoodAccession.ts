import type { PositionedTextLine } from './pdfText'

export function normalizeRedwoodAccession(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const accession = value.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{3,23}$/.test(accession) && /\d/.test(accession) ? accession : null
}

type ReportLine = Pick<PositionedTextLine, 'text' | 'page'> & Partial<Pick<PositionedTextLine, 'items'>>

function findReportHeaderValue(
  lines: ReportLine[],
  labelPattern: string,
  valuePattern: string,
  normalize: (text: string) => string | null,
) {
  const values = new Set<string>()
  const firstPage = lines.filter(({ page }) => page === 1)
  const items = firstPage.flatMap((line) => line.items ?? [])
  const textRuns = [...items.map(({ text }) => text), ...firstPage.filter((line) => !line.items?.length).map(({ text }) => text)]

  const inlineField = new RegExp('\\b' + labelPattern + '\\s*(' + valuePattern + ')(?=\\s|$)', 'gi')
  for (const text of textRuns) {
    for (const [, rawValue] of text.matchAll(inlineField)) {
      const value = normalize(rawValue)
      if (value) values.add(value)
    }
  }

  const standaloneLabel = new RegExp('^' + labelPattern + '\\s*$', 'i')
  for (const label of items.filter(({ text }) => standaloneLabel.test(text))) {
    // Some Redwood PDFs place the value on a slightly lower PDF text baseline. Use the
    // items' coordinates so adjacent requisition and address fields are not mistaken for it.
    const rowTolerance = Math.max(2, label.height / 2)
    for (const item of items) {
      if (
        Math.abs(item.y - label.y) <= rowTolerance &&
        item.x >= label.x + label.width - 1 && item.x <= label.x + 136
      ) {
        const value = normalize(item.text)
        if (value) values.add(value)
      }
    }
  }
  return values.size === 1 ? [...values][0] : null
}

export function findRedwoodAccession(lines: ReportLine[]): string | null {
  return findReportHeaderValue(lines, String.raw`Accession\s*(?:#|No\.?|Number)\s*:`, '[A-Z0-9-]+', normalizeRedwoodAccession)
}

export function findRedwoodReportAccountNumber(lines: ReportLine[]): string | null {
  return findReportHeaderValue(
    lines,
    String.raw`(?:Account|Agency)(?:\s*(?:#|No\.?|Number))?(?:\s*:|(?=\s|$))`,
    String.raw`\d{6}`,
    (text) => /^\d{6}$/.test(text.trim()) ? text.trim() : null,
  )
}
