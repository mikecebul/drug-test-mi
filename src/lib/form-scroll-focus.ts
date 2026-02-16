const FIRST_INTERACTIVE_FIELD_SELECTOR =
  '.wizard-content input:not([type="hidden"]):not([disabled]), .wizard-content select:not([disabled]), .wizard-content textarea:not([disabled])'

type ScrollWithMarginOptions = {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  topMarginPx?: number
}

export function focusElementWithoutScroll(element: HTMLElement | null) {
  if (!element || typeof element.focus !== 'function') return

  requestAnimationFrame(() => {
    element.focus({ preventScroll: true })
  })
}

export function findFirstInteractiveField(container: ParentNode | null) {
  if (!container) return null

  return container.querySelector<HTMLElement>(FIRST_INTERACTIVE_FIELD_SELECTOR)
}

export function focusFirstInteractiveField(container: ParentNode | null) {
  const field = findFirstInteractiveField(container)
  focusElementWithoutScroll(field)
  return field
}

export function scrollElementIntoViewWithMargin(
  element: Element | null,
  {
    behavior = 'smooth',
    block = 'start',
    topMarginPx = 0,
  }: ScrollWithMarginOptions = {},
) {
  if (!element) return

  if (topMarginPx > 0) {
    const top = element.getBoundingClientRect().top + window.scrollY - topMarginPx
    window.scrollTo({ top: Math.max(0, top), behavior })
    return
  }

  element.scrollIntoView({ behavior, block })
}

