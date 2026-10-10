import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultReviewCard } from './ResultReviewCard'

test('unverified screening cannot display a stale final success heading', () => {
  const html = renderToStaticMarkup(
    <ResultReviewCard
      reportLabel="Screening report"
      presentation={{ label: 'Final result passed', variant: 'success' }}
      reportAction={null}
      screening={{
        verified: false,
        detected: [],
        medications: [],
        preview: {
          initialScreenResult: 'negative',
          expectedPositives: [],
          unexpectedPositives: [],
          unexpectedNegatives: [],
          autoAccept: true,
        },
      }}
    />,
  )
  expect(html).not.toContain('Final result passed')
})

test('screening review retains medication context and makes a requested confirmation explicitly pending', () => {
  const html = renderToStaticMarkup(
    <ResultReviewCard
      reportLabel="Screening report"
      presentation={{ label: 'Unexpected positive', variant: 'destructive' }}
      reportAction={null}
      decision="request-confirmation"
      screening={{
        verified: true,
        detected: ['amphetamines', 'buprenorphine'],
        medications: [{ medicationName: 'Suboxone', detectedAs: ['buprenorphine'] }],
        preview: {
          initialScreenResult: 'unexpected-positive',
          expectedPositives: ['buprenorphine'],
          unexpectedPositives: ['amphetamines'],
          unexpectedNegatives: [],
          autoAccept: false,
        },
      }}
    />,
  )
  expect(html).toContain('data-testid="screening-result-amphetamines"')
  expect(html).toContain('Suboxone')
  expect(html).toContain('Final result pending')
  expect(html).not.toContain('Confirmed positive')
})

test('completed confirmations show final per-substance outcomes and specimen context without a pending claim', () => {
  const html = renderToStaticMarkup(
    <ResultReviewCard
      reportLabel="Confirmation report"
      presentation={{ label: 'Confirmed negative', variant: 'success' }}
      reportAction={null}
      decision="request-confirmation"
      confirmations={[{ substance: 'fentanyl', result: 'confirmed-negative' }]}
      isDilute
      breathalyzerTaken
      breathalyzerResult={0.025}
    />,
  )
  expect(html).toContain('Fentanyl')
  expect(html).toContain('Confirmed negative')
  expect(html).toContain('Dilute sample')
  expect(html).toContain('0.025')
  expect(html).not.toContain('Final result pending')
})
