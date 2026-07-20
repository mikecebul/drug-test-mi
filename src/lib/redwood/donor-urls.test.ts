import { describe, expect, it } from 'vitest'

import { buildRedwoodCollectSpecimenUrl } from './donor-urls'

describe('Redwood donor URLs', () => {
  it('builds a donor-specific specimen collection URL', () => {
    expect(buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com/Pages/User/DonorSearch.aspx', ' 2714034 ')).toBe(
      'https://m.toxaccess.com/Pages/User/CollectSpecimen.aspx?donorid=2714034',
    )
  })
})
