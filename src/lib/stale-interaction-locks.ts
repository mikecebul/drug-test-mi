const OPEN_INTERACTION_LAYER_SELECTOR = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="drawer-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
].join(',')

function hasOpenInteractionLayer() {
  if (typeof document === 'undefined') return true
  return Boolean(document.querySelector(OPEN_INTERACTION_LAYER_SELECTOR))
}

export function cleanupStaleInteractionLocks() {
  if (typeof document === 'undefined') return
  if (hasOpenInteractionLayer()) return

  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = ''
  }
}

export function scheduleStaleInteractionLockCleanup(delayMs = 350) {
  if (typeof window === 'undefined') return () => {}

  const timeout = window.setTimeout(() => {
    cleanupStaleInteractionLocks()
  }, delayMs)

  return () => window.clearTimeout(timeout)
}
