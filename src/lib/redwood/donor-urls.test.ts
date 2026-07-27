import { describe, expect, it } from 'vitest'

import {
  buildRedwoodCollectSpecimenUrl,
  REDWOOD_DESKTOP_DONOR_SEARCH_URL,
  resolveGuidedToxAccessHref,
} from './donor-urls'

describe('Redwood donor URLs', () => {
  it('builds a donor-specific lab collection URL at the first mobile workflow step', () => {
    expect(
      buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com/donors', ' 2714034 ', false),
    ).toBe('https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=false')
  })

  it('builds a donor-specific onsite collection URL at the first mobile workflow step', () => {
    expect(
      buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com/donors', ' 2714034 ', true),
    ).toBe('https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=true')
  })

  it('encodes the donor ID as a path segment', () => {
    expect(buildRedwoodCollectSpecimenUrl('https://m.toxaccess.com', ' donor/123 ', false)).toBe(
      'https://m.toxaccess.com/donors/donor%2F123/collection/steps/1?isOnSite=false',
    )
  })

  it('uses the desktop donor record for guided collection on mobile and tablet devices', () => {
    expect(
      resolveGuidedToxAccessHref({
        donorId: '2714034',
        mobileHref: 'https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=false',
        useDesktopSite: true,
      }),
    ).toBe('https://toxaccess.redwoodtoxicology.com/Pages/User/Donor.aspx?donorid=2714034')
  })

  it('uses desktop donor search for manual help on mobile and tablet devices', () => {
    expect(
      resolveGuidedToxAccessHref({
        mobileHref: 'https://m.toxaccess.com/donors',
        useDesktopSite: true,
      }),
    ).toBe(REDWOOD_DESKTOP_DONOR_SEARCH_URL)
  })

  it('keeps the mobile collection app URL for desktop devices', () => {
    const mobileHref = 'https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=false'
    expect(
      resolveGuidedToxAccessHref({
        donorId: '2714034',
        mobileHref,
        useDesktopSite: false,
      }),
    ).toBe(mobileHref)
  })
})
