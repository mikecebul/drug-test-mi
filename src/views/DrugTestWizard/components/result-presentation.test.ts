import { describe, expect, it } from 'vitest'
import { getResultPresentation } from './result-presentation'

describe('collection result presentation safety', () => {
  it('keeps expected-positive distinct from a negative result', () => {
    expect(getResultPresentation('expected-positive')).toEqual({ label: 'Expected positive', variant: 'success' })
    expect(getResultPresentation('negative').label).toBe('Negative')
  })

  it.each(['unexpected-positive', 'unexpected-negative-critical', 'mixed-unexpected'])(
    'flags %s as a red finding',
    (classification) => {
      expect(getResultPresentation(classification).variant).toBe('destructive')
    },
  )

  it('does not show a cached negative as ready while loading or after an error', () => {
    expect(getResultPresentation('negative', 'loading')).toEqual({ label: 'Checking result', variant: 'warning' })
    expect(getResultPresentation('negative', 'error').variant).toBe('destructive')
    expect(getResultPresentation(undefined).variant).toBe('warning')
    expect(getResultPresentation('unrecognized-result').variant).toBe('warning')
  })
})
