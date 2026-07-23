import { describe, expect, it } from 'vitest'

import { buildRedwoodCollectSpecimenUrl } from './donor-urls'

describe('Redwood donor URLs', () => {
  it('builds a donor-specific lab collection URL at the first mobile workflow step', () => {
    expect(
      buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com/Pages/User/DonorSearch.aspx', ' 2714034 ', false),
    ).toBe('https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=false')
  })

  it('builds a donor-specific onsite collection URL at the first mobile workflow step', () => {
    expect(
      buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com/Pages/User/DonorSearch.aspx', ' 2714034 ', true),
    ).toBe('https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=true')
  })

  it('encodes the donor ID as a path segment', () => {
    expect(buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com', ' donor/123 ', false)).toBe(
      'https://m.toxaccess.com/donors/donor%2F123/collection/steps/1?isOnSite=false',
    )
  })
})
