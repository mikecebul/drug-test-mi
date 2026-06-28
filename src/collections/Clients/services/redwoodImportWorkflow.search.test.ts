import { describe, expect, it } from 'vitest'

import { isRedwoodSearchNoMatchError } from '@/collections/Clients/services/redwoodImportWorkflow'

describe('redwood import donor search classification', () => {
  it('treats active and inactive unique ID misses as no-match fallback cases', () => {
    expect(isRedwoodSearchNoMatchError('No Redwood active donor rows found for unique ID "RWD001"')).toBe(true)
    expect(isRedwoodSearchNoMatchError('No Redwood inactive donor rows found for unique ID "RWD001"')).toBe(true)
  })

  it('keeps ambiguous donor matches out of the no-match path', () => {
    expect(
      isRedwoodSearchNoMatchError('Multiple DOB-verified Redwood donor matches are ambiguous in the allowed account'),
    ).toBe(false)
  })
})
