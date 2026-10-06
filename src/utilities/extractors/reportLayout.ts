import type { PositionedTextItem, PositionedTextLine } from './pdfText'

export interface ReportTableRow {
  label: string
  method: string
  cutoffText: string
  resultText: string
  page: number
  y: number
  resultBounds: [number, number, number, number] | null
  layout: 'headers' | 'inferred'
}
type Key = 'label' | 'method' | 'cutoff' | 'result'
interface TableRegion {
  page: number
  y: number
  bottom: number
  left: number
  right: number
  fields: Partial<Record<Key, number>>
  labelEnd: number
}
const METHOD = /^(?:CIA|EA|EIA|LC[/-]MS[/-]MS|GC[/-]MS|Colorimetric)$/i
export const supportedAssayMethod = (method: string) => METHOD.test(normalizeMethod(method))
export const derivedReportRow = (row: ReportTableRow) =>
  /^Calculated$/i.test(row.method) && /creatinine\s*ratio/i.test(row.label)
export const normalizeMethod = (text: string) => text.replace(/\s/g, '')
const ordered = (items: PositionedTextItem[]) => [...items].sort((a, b) => a.x - b.x)
const join = (items: PositionedTextItem[]) =>
  items
    .map((item) => item.text)
    .join(' ')
    .trim()
const LABEL = /^(?:Drug(?:\b.*)?|Substances?|Analytes?|Test)$/i
const END = /^(?:DISCLAIMER\b|Method Index\b|Important Notes?\b|Comments?\(?s?\)?:?|Specimen Validity Tests?)/i

function tableRegions(lines: PositionedTextLine[]): TableRegion[] {
  const regions: TableRegion[] = []
  for (const line of lines) {
    const items = ordered(line.items),
      methods = items.filter((item) => /^Method$/i.test(item.text)),
      labels = items.filter((item) => LABEL.test(item.text))
    if (!methods.length) continue
    for (const [index, method] of methods.entries()) {
      const separateLabels = labels.length >= methods.length
      const label = separateLabels ? labels[index] : labels[0]
      const left = separateLabels ? label.x - 4 : index === 0 ? -Infinity : method.x - 4
      const right = separateLabels ? (labels[index + 1]?.x ?? Infinity) - 4 : (methods[index + 1]?.x ?? Infinity) - 4
      const candidates = items.filter((item) => methods.length === 1 || (item.x >= left && item.x < right))
      const result = candidates.find((item) => /^Results?$/i.test(item.text))
      const cutoff = candidates.find((item) => /^(?:Cutoff|Reference Range)$/i.test(item.text))
      if (!result) continue
      const firstData = Math.min(
        methods[0].x,
        ...items.filter((item) => /^Results?$|^Cutoff$|^Reference Range$/i.test(item.text)).map((item) => item.x),
      )
      regions.push({
        page: line.page,
        y: line.y,
        bottom: -Infinity,
        left: label ? label.x - 8 : -Infinity,
        right,
        fields: {
          label: label?.x ?? firstData - 100,
          method: method.x,
          result: result.x,
          ...(cutoff ? { cutoff: cutoff.x } : {}),
        },
        labelEnd: separateLabels ? Math.min(method.x, result.x, cutoff?.x ?? Infinity) - 4 : firstData - 4,
      })
    }
  }
  for (const region of regions) {
    const next = regions
      .filter((other) => other.page === region.page && other.y < region.y)
      .sort((a, b) => b.y - a.y)[0]
    const end = lines
      .filter((line) => line.page === region.page && line.y < region.y && END.test(line.text.trim()))
      .sort((a, b) => b.y - a.y)[0]
    region.bottom = Math.max(next?.y ?? -Infinity, end?.y ?? -Infinity)
  }
  return regions
}

function cellItems(items: PositionedTextItem[], region: TableRegion, key: Key): PositionedTextItem[] {
  const start = region.fields[key]
  if (start === undefined) return []
  const end =
    key === 'label'
      ? region.labelEnd
      : Math.min(
          region.right,
          ...Object.entries(region.fields)
            .filter(([other, x]) => other !== 'label' && x !== undefined && x > start)
            .map(([, x]) => x! - 4),
        )
  return [...items]
    .sort((a, b) => (Math.abs(a.y - b.y) <= 1.5 ? a.x - b.x : b.y - a.y))
    .filter((item) => item.x >= (key === 'label' ? region.left : start - 4) && item.x < end)
}
const methodAt = (line: PositionedTextLine, region: TableRegion) =>
  normalizeMethod(join(cellItems(line.items, region, 'method')))
export function textBounds(items: PositionedTextItem[]): ReportTableRow['resultBounds'] {
  if (!items.length) return null
  return [
    Math.min(...items.map((item) => item.x)),
    Math.min(...items.map((item) => item.y)),
    Math.max(...items.map((item) => item.x + item.width)),
    Math.max(...items.map((item) => item.y + item.height)),
  ]
}

/** One table-region engine for lab and instant reports, independent of draw order. */
export function extractReportTableRows(lines: PositionedTextLine[]): ReportTableRow[] {
  const sorted = [...lines].sort((a, b) => a.page - b.page || b.y - a.y),
    regions = tableRegions(sorted),
    rows: ReportTableRow[] = []
  for (const line of sorted) {
    const active = regions.filter((region) => region.page === line.page && line.y < region.y && line.y > region.bottom)
    for (const region of active) {
      const method = methodAt(line, region)
      if (!METHOD.test(method)) {
        const label = join(cellItems(line.items, region, 'label')),
          resultText = join(cellItems(line.items, region, 'result'))
        const parent = sorted
          .filter(
            (other) =>
              other.page === line.page &&
              other.y < region.y &&
              other.y > region.bottom &&
              METHOD.test(methodAt(other, region)),
          )
          .some((other) => {
            const above = sorted
              .filter(
                (candidate) =>
                  candidate.page === line.page &&
                  candidate.y > other.y &&
                  candidate.y < region.y &&
                  METHOD.test(methodAt(candidate, region)),
              )
              .sort((a, b) => a.y - b.y)[0]?.y
            const below = sorted
              .filter(
                (candidate) =>
                  candidate.page === line.page &&
                  candidate.y < other.y &&
                  candidate.y > region.bottom &&
                  METHOD.test(methodAt(candidate, region)),
              )
              .sort((a, b) => b.y - a.y)[0]?.y
            return (
              line.y < Math.min(region.y, other.y + 12, above === undefined ? Infinity : (above + other.y) / 2) &&
              line.y > Math.max(region.bottom, other.y - 12, below === undefined ? -Infinity : (below + other.y) / 2)
            )
          })
        if (label && resultText && (method || !parent))
          rows.push({
            label,
            method,
            cutoffText: join(cellItems(line.items, region, 'cutoff')),
            resultText,
            page: line.page,
            y: line.y,
            resultBounds: textBounds(cellItems(line.items, region, 'result')),
            layout: 'headers',
          })
        continue
      }
      const neighbors = sorted.filter(
        (other) =>
          other.page === line.page &&
          other.y < region.y &&
          other.y > region.bottom &&
          METHOD.test(methodAt(other, region)),
      )
      const above = neighbors.filter((other) => other.y > line.y).sort((a, b) => a.y - b.y)[0]?.y,
        below = neighbors.filter((other) => other.y < line.y).sort((a, b) => b.y - a.y)[0]?.y
      const top = Math.min(region.y, line.y + 12, above === undefined ? Infinity : (above + line.y) / 2)
      const bottom = Math.max(region.bottom, line.y - 12, below === undefined ? -Infinity : (below + line.y) / 2)
      const area = sorted
        .filter((other) => other.page === line.page && other.y < top && other.y > bottom)
        .flatMap((other) => other.items)
      const resultItems = cellItems(area, region, 'result')
      rows.push({
        label: join(cellItems(area, region, 'label')),
        method,
        cutoffText: join(cellItems(area, region, 'cutoff')),
        resultText: join(resultItems),
        page: line.page,
        y: line.y,
        resultBounds: textBounds(resultItems),
        layout: 'headers',
      })
    }
    // Do not reinterpret disclaimers, glossaries or text outside a known table.
    if (
      regions.some((region) => region.page === line.page) ||
      sorted.some((other) => other.page === line.page && other.y > line.y && END.test(other.text.trim()))
    )
      continue
    const directMethod = ordered(line.items).find((item) => METHOD.test(normalizeMethod(item.text)))
    if (directMethod) {
      const method = normalizeMethod(directMethod.text),
        before = ordered(line.items).filter((item) => item.x < directMethod.x),
        after = ordered(line.items).filter((item) => item.x >= directMethod.x + directMethod.width)
      if (!before.length) continue
      if (method === 'CIA') {
        const anchor = before.find((item) =>
          /^(?:Negative|NEG|Positive|POS|Presumptive(?:\s*Positive)?|Screened(?:\s*Positive)?|Not Detected)$/i.test(
            item.text,
          ),
        )
        if (anchor) {
          const resultItems = before.filter((item) => item.x >= anchor.x)
          rows.push({
            label: join(before.filter((item) => item.x < anchor.x)),
            method,
            cutoffText: join(after),
            resultText: join(resultItems),
            page: line.page,
            y: line.y,
            resultBounds: textBounds(resultItems),
            layout: 'inferred',
          })
          continue
        }
      }
    }
    const cells: PositionedTextItem[][] = []
    for (const item of ordered(line.items)) {
      const previous = cells.at(-1)?.at(-1)
      if (!previous || item.x - previous.x - previous.width > Math.max(8, item.height * 1.25)) cells.push([item])
      else cells.at(-1)!.push(item)
    }
    const methodIndex = cells.findIndex((cell) => METHOD.test(normalizeMethod(join(cell))))
    if (methodIndex < 1) continue
    const method = normalizeMethod(join(cells[methodIndex])),
      instant = method === 'CIA'
    const resultIndex = instant ? methodIndex - 1 : methodIndex + 2
    const labelCells = instant ? cells.slice(0, Math.max(1, methodIndex - 1)) : cells.slice(0, methodIndex)
    const resultItems = instant && methodIndex < 2 ? [] : (cells[resultIndex] ?? [])
    rows.push({
      label: join(labelCells.flat()),
      method,
      cutoffText: join(cells[methodIndex + 1] ?? []),
      resultText: join(resultItems),
      page: line.page,
      y: line.y,
      resultBounds: textBounds(resultItems),
      layout: 'inferred',
    })
  }
  return rows
}

const KNOWN_FIELD =
  /^(?:Donor Name|Identification|DOB|Date of Birth|Sex|Gender|Collected|Collection Date|Client|Specimen Type|Phone|Account #|Accession #|Requisition #|Received|Reported|Test Reason):$/i
/** Read the field's value region, including split labels/values, stopping at another field. */
export function readReportField(lines: PositionedTextLine[], pattern: RegExp): string | null {
  for (const line of [...lines].sort((a, b) => a.page - b.page || b.y - a.y)) {
    const items = ordered(line.items)
    for (let index = 0; index < items.length; index++) {
      for (let length = 1; length <= 3 && index + length <= items.length; length++) {
        if (!pattern.test(join(items.slice(index, index + length)))) continue
        let end = items.length
        for (let next = index + length; next < items.length; next++) {
          if (
            /^[\p{L}][\p{L}\s#()/-]*:$/u.test(items[next].text) ||
            [2, 3].some((span) => KNOWN_FIELD.test(join(items.slice(next, next + span))))
          ) {
            end = next
            break
          }
        }
        const value = join(items.slice(index + length, end))
        if (value) return value
      }
    }
  }
  return null
}

export function reportSummaryLines(lines: PositionedTextLine[]): PositionedTextLine[] {
  const heading = lines.find((line) => line.items.some((item) => /^Summary$/i.test(item.text)))
  if (!heading) return []
  const table = tableRegions(lines)
    .filter((region) => region.page === heading.page && region.y < heading.y)
    .sort((a, b) => b.y - a.y)[0]
  const label = heading.items.find((item) => /^Summary$/i.test(item.text))!,
    neighbor = heading.items.find((item) => item.x > label.x && /^Tests Ordered$/i.test(item.text))
  const margin = Math.min(
    ...lines.filter((line) => line.page === heading.page).flatMap((line) => line.items.map((item) => item.x)),
  )
  const right = neighbor ? Math.min(neighbor.x - 12, 2 * (label.x + label.width / 2) - margin) : Infinity
  return lines
    .filter((line) => line.page === heading.page && line.y < heading.y && line.y > (table?.y ?? 0))
    .map((line) => ({ ...line, items: ordered(line.items).filter((item) => item.x < right) }))
    .map((line) => ({ ...line, text: join(line.items) }))
    .filter((line) => line.items.length)
}

/** Only report body text, never footer disclaimers/glossary definitions. */
export function reportBodyLines(lines: PositionedTextLine[]): PositionedTextLine[] {
  return lines.filter(
    (line) => !lines.some((other) => other.page === line.page && other.y >= line.y && END.test(other.text.trim())),
  )
}
