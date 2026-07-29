import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDeviceType } from '@/hooks/use-device-type'
import { deriveRedwoodProvisioningStatus } from '@/lib/redwood/provisioning'
import { RedwoodProvisioningCard } from './RedwoodProvisioningCard'

vi.mock('@/hooks/use-device-type', () => ({
  useDeviceType: vi.fn(),
}))

type ProvisioningInput = Parameters<typeof deriveRedwoodProvisioningStatus>[0]
const mockedUseDeviceType = vi.mocked(useDeviceType)

function renderCard(input: ProvisioningInput) {
  return renderToStaticMarkup(<RedwoodProvisioningCard status={createStatus(input)} isLoading={false} />)
}

function createStatus(input: ProvisioningInput) {
  const status = deriveRedwoodProvisioningStatus(input)

  return {
    ...status,
    collectSpecimenHref: status.donorId
      ? `https://m.toxaccess.com/donors/${status.donorId}/collection/steps/1?isOnSite=false`
      : null,
    manualHref: 'https://m.toxaccess.com/donors',
  }
}

describe('RedwoodProvisioningCard', () => {
  beforeEach(() => {
    mockedUseDeviceType.mockReturnValue('tablet')
  })

  it('shows one concise status while automatic setup is working', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'not-queued',
      donorId: null,
      headshotRequired: false,
      syncStatus: 'queued',
    })

    expect(markup).toContain('Setting up ToxAccess donor')
    expect(markup).toContain('Working')
    expect(markup).toContain('This is happening automatically')
    expect(markup).not.toContain('Donor record')
    expect(markup).not.toContain('Open ToxAccess')
    expect(markup).not.toContain('Retry setup')
  })

  it('shows a green ready state and a clear collection action', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'synced',
      donorId: '2714034',
      headshotRequired: false,
      syncStatus: 'synced',
    })

    expect(markup).toContain('Donor ready')
    expect(markup).toContain('Ready for collection')
    expect(markup).toContain('Donor 2714034 is ready for collection in ToxAccess.')
    expect(markup).toContain('Link to ToxAccess')
    expect(markup).toContain(
      'https://m.toxaccess.com/donors/2714034/collection/steps/1?isOnSite=false',
    )
    expect(markup).not.toContain('toxaccess.redwoodtoxicology.com')
    expect(markup).not.toContain('Donor verified in ToxAccess')
    expect(markup).not.toContain('remaining headshot')
    expect(markup).not.toContain('Retry setup')
  })

  it('uses the desktop donor link on desktop devices', () => {
    mockedUseDeviceType.mockReturnValue('desktop')

    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'synced',
      donorId: '2714034',
      headshotRequired: false,
      syncStatus: 'synced',
    })

    expect(markup).toContain(
      'https://toxaccess.redwoodtoxicology.com/Pages/User/Donor.aspx?donorid=2714034',
    )
    expect(markup).not.toContain('https://m.toxaccess.com')
  })

  it('keeps the ready state simple while optional headshot work continues', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: '2714034',
      headshotRequired: true,
      headshotStatus: 'queued',
      syncStatus: 'synced',
    })

    expect(markup).toContain('Donor ready')
    expect(markup).toContain('Link to ToxAccess')
    expect(markup).not.toContain('warning')
    expect(markup).not.toContain('headshot')
  })

  it('preserves the donor link when optional headshot upload fails', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: '2714034',
      headshotRequired: true,
      headshotStatus: 'failed',
      lastError: 'Headshot upload failed.',
      syncStatus: 'synced',
    })

    expect(markup).toContain('Donor ready')
    expect(markup).toContain('Link to ToxAccess')
    expect(markup).not.toContain('ToxAccess setup needs help')
    expect(markup).not.toContain('search for the donor manually')
  })

  it('shows a focused default-test warning while preserving the donor link', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'failed',
      donorId: '2714034',
      headshotRequired: false,
      lastError: 'Default test could not be set.',
      syncStatus: 'synced',
    })

    expect(markup).toContain('Default test needs help')
    expect(markup).toContain('default test was not verified')
    expect(markup).toContain('(231) 373-6341')
    expect(markup).toContain('Link to ToxAccess')
    expect(markup).not.toContain('search for the donor manually')
  })

  it('shows simple contact and manual-search instructions after setup fails', () => {
    const markup = renderCard({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: null,
      headshotRequired: false,
      lastError: 'ToxAccess timed out after retries.',
      syncStatus: 'failed',
    })

    expect(markup).toContain('ToxAccess setup needs help')
    expect(markup).toContain('(231) 373-6341')
    expect(markup).toContain('search for the donor manually')
    expect(markup).toContain('Open ToxAccess to search manually')
    expect(markup).toContain('href="https://m.toxaccess.com/donors"')
    expect(markup).not.toContain('toxaccess.redwoodtoxicology.com')
    expect(markup).not.toContain('ToxAccess timed out after retries.')
    expect(markup).not.toContain('Retry setup')
  })
})
