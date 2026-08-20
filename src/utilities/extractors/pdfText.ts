import type { TextItem } from 'pdfjs-dist/types/src/display/api.js'

export interface PositionedTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

export interface PositionedTextLine {
  items: PositionedTextItem[]
  page: number
  y: number
  text: string
}

export interface PositionedPdfText {
  lines: PositionedTextLine[]
  rawText: string
  pageCount: number
}

const normalizeText = (value: string) =>
  value
    .replace(/[\u00ad\u2010\u2011\u2012\u2013\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item && 'transform' in item)
}

function buildLineText(items: PositionedTextItem[]): string {
  let text = ''
  let previous: PositionedTextItem | undefined

  for (const item of items) {
    if (previous) {
      const gap = item.x - (previous.x + previous.width)
      const tabThreshold = Math.max(8, Math.max(previous.height, item.height) * 1.25)
      text += gap > tabThreshold ? '\t' : ' '
    }
    text += item.text
    previous = item
  }

  return text.trim()
}

function groupIntoLines(items: PositionedTextItem[]): PositionedTextLine[] {
  const lines: PositionedTextLine[] = []

  for (const item of [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const tolerance = Math.max(1.5, item.height * 0.3)
    let line = lines.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= tolerance)

    if (!line) {
      line = { items: [], page: item.page, y: item.y, text: '' }
      lines.push(line)
    }

    line.items.push(item)
  }

  return lines
    .map((line) => {
      const sortedItems = line.items.sort((a, b) => a.x - b.x)
      return { ...line, items: sortedItems, text: buildLineText(sortedItems) }
    })
    .sort((a, b) => a.page - b.page || b.y - a.y)
}

/**
 * Extract text together with PDF-space coordinates using PDF.js' legacy build.
 *
 * Parsing remains server-side, but the legacy entry avoids modern-runtime syntax
 * assumptions and matches the compatibility path used for Safari-facing uploads.
 */
export async function extractPositionedPdfText(buffer: Buffer): Promise<PositionedPdfText> {
  const { getDocument, VerbosityLevel } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: false,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  })

  try {
    const pdf = await loadingTask.promise
    const items: PositionedTextItem[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()

      for (const contentItem of content.items) {
        if (!isTextItem(contentItem)) continue

        const text = normalizeText(contentItem.str)
        if (!text) continue

        items.push({
          text,
          x: contentItem.transform[4],
          y: contentItem.transform[5],
          width: contentItem.width,
          height: contentItem.height || Math.hypot(contentItem.transform[2], contentItem.transform[3]),
          page: pageNumber,
        })
      }

      page.cleanup()
    }

    const lines = groupIntoLines(items)
    return {
      lines,
      rawText: lines.map((line) => line.text).join('\n'),
      pageCount: pdf.numPages,
    }
  } finally {
    await loadingTask.destroy()
  }
}

export function findAnchoredValue(
  lines: PositionedTextLine[],
  labelPattern: RegExp,
  valuePattern?: RegExp,
): string | null {
  for (const line of lines) {
    const labelIndex = line.items.findIndex((item) => labelPattern.test(item.text))
    if (labelIndex < 0) continue

    for (const item of line.items.slice(labelIndex + 1)) {
      if (/^[\p{L}][\p{L}\s]+:$/u.test(item.text)) break
      if (!valuePattern || valuePattern.test(item.text)) return item.text
    }
  }

  return null
}

export function findAnchoredLine(lines: PositionedTextLine[], labelPattern: RegExp): PositionedTextLine | undefined {
  return lines.find((line) => line.items.some((item) => labelPattern.test(item.text)))
}

export function normalizeSubstanceLabel(value: string): string {
  return normalizeText(value)
    .replace(/\*/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}
