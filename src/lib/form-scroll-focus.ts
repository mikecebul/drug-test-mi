'use client'

import { RefObject, useEffect, useRef } from 'react'
import { toast } from 'sonner'

const FIRST_INTERACTIVE_FIELD_SELECTOR =
  '.wizard-content input:not([type="hidden"]):not([disabled]), .wizard-content select:not([disabled]), .wizard-content textarea:not([disabled])'

type ScrollWithMarginOptions = {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  topMarginPx?: number
}

type UseStepFocusOptions<TStepKey> = {
  containerRef: RefObject<ParentNode | null>
  disabled?: boolean
  onStepChange?: () => void
  scrollBehavior?: ScrollBehavior
  skipInitialFocus?: boolean
  stepKey: TStepKey
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

export function focusFirstInvalidField(container: ParentNode | null) {
  const field =
    Array.from(container?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? []).find(
      (candidate) => candidate.getClientRects().length > 0,
    ) ?? null
  if (!field) return false

  scrollElementIntoViewWithMargin(field, {
    behavior: 'smooth',
    block: 'center',
  })
  focusElementWithoutScroll(field)
  return true
}

export function focusFirstInvalidFieldWithToast(container: ParentNode | null, toastId: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const focusedField = focusFirstInvalidField(container)

        toast.error(focusedField ? 'Please fix the highlighted field.' : 'Please complete the required fields.', {
          id: toastId,
        })
      })
    })
  })

  return false
}

export function scrollElementIntoViewWithMargin(
  element: Element | null,
  { behavior = 'smooth', block = 'start', topMarginPx = 0 }: ScrollWithMarginOptions = {},
) {
  if (!element) return

  if (topMarginPx > 0) {
    const top = element.getBoundingClientRect().top + window.scrollY - topMarginPx
    window.scrollTo({ top: Math.max(0, top), behavior })
    return
  }

  element.scrollIntoView({ behavior, block })
}

export function useStepFocus<TStepKey>({
  containerRef,
  disabled = false,
  onStepChange,
  scrollBehavior = 'smooth',
  skipInitialFocus = true,
  stepKey,
}: UseStepFocusOptions<TStepKey>) {
  const hasInitializedStepRef = useRef(false)

  useEffect(() => {
    if (disabled) return

    onStepChange?.()

    if (skipInitialFocus && !hasInitializedStepRef.current) {
      hasInitializedStepRef.current = true
      return
    }

    hasInitializedStepRef.current = true
    const firstField = findFirstInteractiveField(containerRef.current)

    window.scrollTo({ top: 0, behavior: scrollBehavior })
    focusElementWithoutScroll(firstField)
  }, [containerRef, disabled, onStepChange, scrollBehavior, skipInitialFocus, stepKey])
}
