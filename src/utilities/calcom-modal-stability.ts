const CAL_MODAL_SELECTOR = 'cal-modal-box'
const CAL_MODAL_PATCH_ATTRIBUTE = 'data-mi-drug-test-modal-stability'
const CAL_MODAL_STYLE_ATTRIBUTE = 'data-mi-drug-test-mobile-styles'

const MOBILE_MODAL_STYLES = `
  @media (max-width: 640px) {
    .my-backdrop {
      height: 100dvh;
      min-height: 100dvh;
    }

    .header {
      top: max(16px, env(safe-area-inset-top));
      z-index: 1;
    }

    .close {
      align-items: center;
      display: inline-flex;
      height: 44px;
      justify-content: center;
      line-height: 1;
      width: 44px;
    }

    .modal-box {
      max-height: calc(100dvh - 100px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }
`

type CalModalClickEvent = Pick<Event, 'composedPath' | 'preventDefault' | 'stopImmediatePropagation'>

function isCloseControl(target: EventTarget): boolean {
  const candidate = target as EventTarget & { matches?: (selector: string) => boolean }
  return candidate.matches?.('.close, [aria-label="Close"]') ?? false
}

export function preventAccidentalCalModalClose(event: CalModalClickEvent): void {
  if (event.composedPath().some(isCloseControl)) return

  event.preventDefault()
  event.stopImmediatePropagation()
}

function patchCalModal(modal: HTMLElement): void {
  if (modal.hasAttribute(CAL_MODAL_PATCH_ATTRIBUTE)) return

  const shadowRoot = modal.shadowRoot
  const backdrop = shadowRoot?.querySelector<HTMLElement>('.my-backdrop')
  if (!shadowRoot || !backdrop) return

  modal.setAttribute(CAL_MODAL_PATCH_ATTRIBUTE, 'true')
  backdrop.addEventListener('click', preventAccidentalCalModalClose)

  if (!shadowRoot.querySelector(`[${CAL_MODAL_STYLE_ATTRIBUTE}]`)) {
    const style = document.createElement('style')
    style.setAttribute(CAL_MODAL_STYLE_ATTRIBUTE, 'true')
    style.textContent = MOBILE_MODAL_STYLES
    shadowRoot.appendChild(style)
  }
}

function patchAvailableCalModals(): void {
  document.querySelectorAll<HTMLElement>(CAL_MODAL_SELECTOR).forEach(patchCalModal)
}

/**
 * Cal.com's modal is created asynchronously as a custom element. Its host closes
 * whenever an unhandled click bubbles out of the shadow root, so a mobile layout
 * shift can turn a select-option tap into a backdrop dismissal. Patch the modal
 * as soon as it is attached, while leaving the explicit close button functional.
 */
export function installCalModalStabilityPatch(): void {
  patchAvailableCalModals()

  const observer = new MutationObserver(patchAvailableCalModals)
  observer.observe(document.body, { childList: true })

  window.setTimeout(() => observer.disconnect(), 10_000)
}
