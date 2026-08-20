import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { extractPositionedPdfText } from '../pdfText'

describe('PDF.js Node runtime', () => {
  test('loads the geometry polyfills required before PDF.js initializes', async () => {
    const fixture = await fs.readFile(path.join(__dirname, 'fixtures/17-panel-instant/all-neg.pdf'))

    const result = await extractPositionedPdfText(fixture)

    expect(result.pageCount).toBeGreaterThan(0)
    expect(globalThis.DOMMatrix).toBeDefined()
    expect(globalThis.Path2D).toBeDefined()
  })
})
