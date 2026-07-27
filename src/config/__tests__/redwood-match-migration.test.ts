import { describe, expect, it, vi } from 'vitest'

import {
  ISAAC_CLIENT_ID,
  up as clearIsaacLegacyRedwoodMatch,
} from '@/migrations/20260724_000000_clear_isaac_legacy_redwood_match'

function createPayload(modifiedCount: number) {
  const updateOne = vi.fn().mockResolvedValue({ modifiedCount })

  return {
    db: {
      collections: {
        clients: {
          collection: {
            updateOne,
          },
        },
      },
    },
    logger: {
      info: vi.fn(),
    },
    updateOne,
  }
}

describe('Isaac legacy ToxAccess match migration', () => {
  it('unsets only Isaac’s obsolete unique-id match metadata', async () => {
    const payload = createPayload(1)
    const session = { id: 'migration-session' }

    await clearIsaacLegacyRedwoodMatch({ payload, session } as never)

    expect(payload.updateOne).toHaveBeenCalledWith(
      {
        $expr: {
          $eq: [{ $toString: '$_id' }, ISAAC_CLIENT_ID],
        },
        redwoodMatchedBy: 'unique-id',
      },
      {
        $unset: {
          redwoodMatchedBy: '',
        },
      },
      { session },
    )
  })

  it('is a safe no-op when Isaac or the obsolete value is absent', async () => {
    const payload = createPayload(0)

    await clearIsaacLegacyRedwoodMatch({ payload } as never)

    expect(payload.updateOne).toHaveBeenCalledOnce()
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('cleanup skipped'))
  })
})
