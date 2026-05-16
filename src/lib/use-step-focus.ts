'use client'

import { RefObject, useEffect, useRef } from 'react'
import { focusElementWithoutScroll, findFirstInteractiveField } from './form-scroll-focus'

type UseStepFocusOptions<TStepKey> = {
  containerRef: RefObject<ParentNode | null>
  disabled?: boolean
  onStepChange?: () => void
  scrollBehavior?: ScrollBehavior
  skipInitialFocus?: boolean
  stepKey: TStepKey
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
