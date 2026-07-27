import { describe, expect, it, vi } from 'vitest'

import { syncLinkedClientDefaultTestsFromReferral } from '../syncLinkedClientDefaultTestsFromReferral'

type HookArgs = Parameters<ReturnType<typeof syncLinkedClientDefaultTestsFromReferral>>[0]

function createArgs(overrides?: Partial<HookArgs>): HookArgs {
  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: [
        { id: 'client-1', defaultTestType: null },
        { id: 'client-2', defaultTestType: '8-panel-lab' },
      ],
      totalPages: 1,
    }),
    update: vi.fn().mockResolvedValue({}),
    logger: {
      info: vi.fn(),
    },
  }

  return {
    collection: {} as never,
    context: {},
    data: {},
    doc: {
      id: 'employer-1',
      preferredTestType: '8-panel-lab',
    },
    operation: 'update',
    previousDoc: {
      preferredTestType: '11-panel-lab',
    },
    req: {
      payload,
    } as never,
    ...overrides,
  } as HookArgs
}

describe('syncLinkedClientDefaultTestsFromReferral', () => {
  it('updates linked clients when a referral preferred test changes', async () => {
    const args = createArgs()
    const hook = syncLinkedClientDefaultTestsFromReferral('employers')

    await hook(args)

    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        where: {
          and: [{ 'referral.relationTo': { equals: 'employers' } }, { 'referral.value': { equals: 'employer-1' } }],
        },
        req: args.req,
      }),
    )
    expect(args.req.payload.update).toHaveBeenCalledTimes(1)
    expect(args.req.payload.update).toHaveBeenCalledWith({
      collection: 'clients',
      id: 'client-1',
      data: {
        defaultTestType: '8-panel-lab',
      },
      overrideAccess: true,
      req: args.req,
    })
  })

  it('does nothing when the preferred test did not change', async () => {
    const args = createArgs({
      previousDoc: {
        preferredTestType: '8-panel-lab',
      },
    })
    const hook = syncLinkedClientDefaultTestsFromReferral('employers')

    await hook(args)

    expect(args.req.payload.find).not.toHaveBeenCalled()
    expect(args.req.payload.update).not.toHaveBeenCalled()
  })

  it('clears linked client defaults when the referral recommendation is removed', async () => {
    const args = createArgs({
      doc: {
        id: 'court-1',
        preferredTestType: null,
      },
      previousDoc: {
        preferredTestType: '11-panel-lab',
      },
    })
    vi.mocked(args.req.payload.find).mockResolvedValue({
      docs: [{ id: 'client-1', defaultTestType: '11-panel-lab' }],
      totalPages: 1,
    } as never)
    const hook = syncLinkedClientDefaultTestsFromReferral('courts')

    await hook(args)

    expect(args.req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'client-1',
        data: { defaultTestType: null },
      }),
    )
  })
})
