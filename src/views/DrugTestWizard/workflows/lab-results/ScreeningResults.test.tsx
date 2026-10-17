import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScreeningResults, screeningResultRows } from './ScreeningResults'
import type { CollectionResultPreview } from '../../components/CollectionResultStrip'
const preview: CollectionResultPreview = {
  initialScreenResult: 'unexpected-positive',
  expectedPositives: ['buprenorphine'],
  unexpectedPositives: ['amphetamines'],
  unexpectedNegatives: [],
  autoAccept: false,
}
const meds = [{ medicationName: 'Suboxone', detectedAs: ['buprenorphine'], required: true }]
test('separates unexpected and expected detections with collection-time medication context', () => {
  const rows = screeningResultRows(preview, ['buprenorphine', 'amphetamines'], meds)
  expect(rows.positives).toEqual([
    { substance: 'amphetamines', medicationNames: [], status: 'unexpected' },
    { substance: 'buprenorphine', medicationNames: ['Suboxone'], status: 'expected' },
  ])
})
test('missing expected substances retain their individual critical/warning status', () => {
  const value = {
    ...preview,
    initialScreenResult: 'mixed-unexpected',
    unexpectedNegatives: ['buprenorphine', 'benzodiazepines'],
  }
  expect(
    screeningResultRows(
      value,
      ['amphetamines'],
      [...meds, { medicationName: 'Valium', detectedAs: ['benzodiazepines'], required: false }],
    ).missing.map((row) => row.status),
  ).toEqual(['critical-missing', 'missing'])
})
test.each([{ verified: false }, { verified: true, isLoading: true }, { verified: true, error: true }])(
  'unverified or unavailable results do not show a green negative result',
  (state) => {
    const html = renderToStaticMarkup(
      <ScreeningResults
        {...state}
        preview={{ ...preview, initialScreenResult: 'negative' }}
        detected={[]}
        medications={[]}
      />,
    )
    expect(html).not.toContain('data-testid="screening-result-')
    expect(html).not.toContain('bg-success-muted')
  },
)
test('breathalyzer failure and dilution stay visible alongside otherwise expected detections', () => {
  const html = renderToStaticMarkup(
    <ScreeningResults
      verified
      preview={preview}
      detected={['buprenorphine']}
      medications={meds}
      isDilute
      breathalyzerTaken
      breathalyzerResult={0.025}
    />,
  )
  expect(html).toContain('0.025')
  expect(html).toContain('border-destructive-border')
  expect(html).toContain('border-warning-border')
})

test('an overall critical result does not turn a known medication warning into a critical row', () => {
  const value = {
    ...preview,
    initialScreenResult: 'unexpected-negative-critical',
    unexpectedPositives: [],
    unexpectedNegatives: ['buprenorphine', 'benzodiazepines'],
  }
  const rows = screeningResultRows(
    value,
    [],
    [...meds, { medicationName: 'Valium', detectedAs: ['benzodiazepines'], required: false }],
  )
  expect(rows.missing.map((row) => row.status)).toEqual(['critical-missing', 'missing'])
})
