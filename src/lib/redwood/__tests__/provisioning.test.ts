import { describe, expect, it } from 'vitest'

import { deriveRedwoodProvisioningStatus } from '@/lib/redwood/provisioning'

describe('deriveRedwoodProvisioningStatus', () => {
  it('allows collection when the donor and required lab default are verified', () => {
    const result = deriveRedwoodProvisioningStatus({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'synced',
      donorId: '2714034',
      headshotRequired: false,
      headshotStatus: 'not-queued',
      syncStatus: 'synced',
    })

    expect(result.canContinue).toBe(true)
    expect(result.overallStatus).toBe('ready')
    expect(result.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'donor', status: 'complete' }),
        expect.objectContaining({ id: 'default-test', status: 'complete' }),
        expect.objectContaining({ id: 'headshot', status: 'skipped' }),
      ]),
    )
  })

  it('keeps collection blocked while donor creation is running', () => {
    const result = deriveRedwoodProvisioningStatus({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: null,
      headshotRequired: false,
      syncStatus: 'queued',
    })

    expect(result.canContinue).toBe(false)
    expect(result.overallStatus).toBe('working')
    expect(result.steps[0]).toEqual(expect.objectContaining({ status: 'running' }))
  })

  it('routes exhausted donor creation to manual fallback', () => {
    const result = deriveRedwoodProvisioningStatus({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: null,
      headshotRequired: false,
      lastError: 'Login timed out after retries',
      syncStatus: 'failed',
    })

    expect(result.canContinue).toBe(false)
    expect(result.overallStatus).toBe('failed')
    expect(result.lastError).toContain('Login timed out')
  })

  it('does not block collection on a pending headshot once donor setup is complete', () => {
    const result = deriveRedwoodProvisioningStatus({
      automationEnabled: true,
      defaultTestRequired: false,
      donorId: '2714034',
      headshotRequired: true,
      headshotStatus: 'queued',
      syncStatus: 'matched-existing',
    })

    expect(result.canContinue).toBe(true)
    expect(result.overallStatus).toBe('ready-with-warnings')
  })

  it('allows a verified donor to continue with a manual default-test warning after terminal failure', () => {
    const result = deriveRedwoodProvisioningStatus({
      automationEnabled: true,
      defaultTestRequired: true,
      defaultTestStatus: 'failed',
      donorId: '2714034',
      headshotRequired: false,
      syncStatus: 'synced',
    })

    expect(result.canContinue).toBe(true)
    expect(result.overallStatus).toBe('ready-with-warnings')
    expect(result.steps[1]).toEqual(expect.objectContaining({ id: 'default-test', status: 'failed' }))
  })
})
