import { describe, expect, test, vi } from 'vitest'

import { preventAccidentalCalModalClose } from '../calcom-modal-stability'

function createTarget(matches: boolean): EventTarget {
  return {
    matches: () => matches,
  } as unknown as EventTarget
}

describe('preventAccidentalCalModalClose', () => {
  test('allows the explicit Cal.com close control', () => {
    const preventDefault = vi.fn()
    const stopImmediatePropagation = vi.fn()

    preventAccidentalCalModalClose({
      composedPath: () => [createTarget(false), createTarget(true)],
      preventDefault,
      stopImmediatePropagation,
    })

    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopImmediatePropagation).not.toHaveBeenCalled()
  })

  test('blocks clicks that would otherwise dismiss the modal from its backdrop', () => {
    const preventDefault = vi.fn()
    const stopImmediatePropagation = vi.fn()

    preventAccidentalCalModalClose({
      composedPath: () => [createTarget(false), createTarget(false)],
      preventDefault,
      stopImmediatePropagation,
    })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopImmediatePropagation).toHaveBeenCalledOnce()
  })
})
