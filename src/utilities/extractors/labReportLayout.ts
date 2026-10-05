import type { PositionedTextItem, PositionedTextLine } from './pdfText'

export interface LabTableRow {
  label: string
  method: string
  cutoffText: string
  resultText: string
  page: number
  y: number
  resultBounds: [number, number, number, number] | null
}

const METHOD = /^(?:EA|EIA|LC\s*[/-]\s*MS\s*[/-]\s*MS|GC\s*[/-]\s*MS|Colorimetric)$/i
interface Columns {
  page: number
  y: number
  method: number
  cutoff: number
  result: number
  end: number
  labelEnd: number
  bottom: number
}

const ordered = (items: PositionedTextItem[]) => [...items].sort((a, b) => a.x - b.x)
const join = (items: PositionedTextItem[]) =>
  items
    .map((item) => item.text)
    .join(' ')
    .trim()
const methodInColumn = (line: PositionedTextLine, column: Columns) =>
  join(ordered(line.items).filter((item) => item.x >= column.method - 12 && item.x < column.cutoff - 4))

function tableColumns(lines: PositionedTextLine[]): Columns[] {
  const columns: Columns[] = []
  for (const line of lines) {
    const items = ordered(line.items)
    const methods = items.filter((item) => /^Method$/i.test(item.text))
    const groups = methods.flatMap((method, index) => {
      const next = methods[index + 1]?.x ?? Infinity
      const cutoff = items.find(
        (item) => item.x > method.x && item.x < next && /^(?:Cutoff|Reference Range)$/i.test(item.text),
      )
      const result = items.find(
        (item) => item.x > (cutoff?.x ?? Infinity) && item.x < next && /^Results?$/i.test(item.text),
      )
      if (!cutoff || !result) return []
      return [
        {
          page: line.page,
          y: line.y,
          method: method.x,
          cutoff: cutoff.x,
          result: result.x,
          end: Number.isFinite(next) ? next - 4 : Infinity,
          labelEnd: methods[0].x - 12,
          bottom: -Infinity,
        },
      ]
    })
    columns.push(...groups)
  }
  for (const column of columns) {
    const nextHeader = columns
      .filter((other) => other.page === column.page && other.y < column.y)
      .sort((a, b) => b.y - a.y)[0]
    const sectionEnd = lines
      .filter(
        (line) =>
          line.page === column.page &&
          line.y < column.y &&
          /^(?:Method Index|Important Notes?|Comments?\(?s?\)?:?|Specimen Validity Tests?)$/i.test(line.text.trim()),
      )
      .sort((a, b) => b.y - a.y)[0]
    column.bottom = Math.max(nextHeader?.y ?? -Infinity, sectionEnd?.y ?? -Infinity)
  }
  return columns
}

function bounds(items: PositionedTextItem[]): LabTableRow['resultBounds'] {
  if (!items.length) return null
  return [
    Math.min(...items.map((item) => item.x)),
    Math.min(...items.map((item) => item.y)),
    Math.max(...items.map((item) => item.x + item.width)),
    Math.max(...items.map((item) => item.y + item.height)),
  ]
}

/** Select cells using the table's own column headings, independent of PDF draw order. */
export function extractLabTableRows(lines: PositionedTextLine[]): LabTableRow[] {
  const sortedLines = [...lines].sort((a, b) => a.page - b.page || b.y - a.y)
  const columns = tableColumns(sortedLines)
  const rows: LabTableRow[] = []
  for (const line of sortedLines) {
    const candidates = ordered(line.items).filter((item) => METHOD.test(item.text))
    for (const column of columns.filter(
      (column) => column.page === line.page && column.y > line.y && line.y > column.bottom,
    )) {
      const text = methodInColumn(line, column)
      if (METHOD.test(text) && !candidates.some((item) => Math.abs(item.x - column.method) < 12))
        candidates.push({ text, x: column.method, y: line.y, page: line.page, width: 0, height: 10 })
    }
    for (const method of candidates) {
      const active = columns
        .filter(
          (column) =>
            column.page === line.page &&
            column.y > line.y &&
            line.y > column.bottom &&
            method.x >= column.method - 12 &&
            method.x < column.cutoff - 4,
        )
        .sort((a, b) => b.y - a.y)[0]
      if (active) {
        const neighbors = sortedLines.filter(
          (other) =>
            other.page === line.page &&
            other.y < active.y &&
            other.y > active.bottom &&
            METHOD.test(methodInColumn(other, active)),
        )
        const above = neighbors.filter((other) => other.y > line.y).sort((a, b) => a.y - b.y)[0]?.y
        const below = neighbors.filter((other) => other.y < line.y).sort((a, b) => b.y - a.y)[0]?.y
        const top = Math.min(active.y, line.y + 12, above === undefined ? Infinity : (above + line.y) / 2)
        const bottom = Math.max(active.bottom, line.y - 12, below === undefined ? -Infinity : (below + line.y) / 2)
        const area = sortedLines.filter((other) => other.page === line.page && other.y < top && other.y > bottom)
        const labelItems = area.flatMap((other) => ordered(other.items).filter((item) => item.x < active.labelEnd))
        const cutoffItems = area.flatMap((other) =>
          ordered(other.items).filter((item) => item.x >= active.cutoff - 4 && item.x < active.result - 4),
        )
        const resultItems = area.flatMap((other) =>
          ordered(other.items).filter((item) => item.x >= active.result - 4 && item.x < active.end),
        )
        rows.push({
          label: join(labelItems),
          method: method.text,
          cutoffText: join(cutoffItems),
          resultText: join(resultItems),
          page: line.page,
          y: line.y,
          resultBounds: bounds(resultItems),
        })
        continue
      }
      // Once a page has real table headings, text outside those table regions
      // must not be reinterpreted as a headerless result (for example a glossary).
      if (columns.some((column) => column.page === line.page)) continue
      // Older/synthetic reports omit headings. Keep a bounded four-cell layout
      // fallback, grouping split text by its horizontal gap, not array position.
      const preceding = ordered(line.items).filter((item) => item.x < method.x)
      if (!preceding.length || preceding.some((item) => METHOD.test(item.text))) continue
      const after = ordered(line.items).filter((item) => item.x > method.x + method.width)
      const cells: PositionedTextItem[][] = []
      for (const item of after) {
        const previous = cells.at(-1)?.at(-1)
        if (!previous || item.x - (previous.x + previous.width) > Math.max(8, item.height * 1.25)) cells.push([item])
        else cells.at(-1)!.push(item)
      }
      if (cells.length !== 2) continue
      rows.push({
        label: join(preceding),
        method: method.text,
        cutoffText: join(cells[0]),
        resultText: join(cells[1]),
        page: line.page,
        y: line.y,
        resultBounds: bounds(cells[1]),
      })
    }
  }
  return rows
}

/** Read only the value region beside a header label, stopping at the next label. */
export function readLabField(lines: PositionedTextLine[], pattern: RegExp): string | null {
  for (const line of [...lines].sort((a, b) => a.page - b.page || b.y - a.y)) {
    const items = ordered(line.items)
    const index = items.findIndex((item) => pattern.test(item.text))
    if (index < 0) continue
    const end = items.findIndex((item, i) => i > index && /^[\p{L}][\p{L}\s#()/-]*:$/u.test(item.text))
    const value = join(items.slice(index + 1, end < 0 ? undefined : end))
    if (value) return value
  }
  return null
}

/** Limit summary values to the Summary region above the result table. */
export function labSummaryLines(lines: PositionedTextLine[]): PositionedTextLine[] {
  const heading = lines.find((line) => line.items.some((item) => /^Summary$/i.test(item.text)))
  if (!heading) return []
  const table = tableColumns(lines)
    .filter((column) => column.page === heading.page && column.y < heading.y)
    .sort((a, b) => b.y - a.y)[0]
  const summaryX = heading.items.find((item) => /^Summary$/i.test(item.text))!.x
  const neighbor = heading.items.find((item) => item.x > summaryX && /^Tests Ordered$/i.test(item.text))
  const right = neighbor ? (summaryX + neighbor.x) / 2 : Infinity
  return lines
    .filter((line) => line.page === heading.page && line.y < heading.y && line.y > (table?.y ?? heading.y - 150))
    .map((line) => ({ ...line, items: ordered(line.items).filter((item) => item.x < right) }))
    .map((line) => ({ ...line, text: join(line.items) }))
    .filter((line) => line.items.length)
}
