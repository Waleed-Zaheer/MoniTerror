/**
 * useFocusTrap — traps Tab/Shift+Tab inside a container while `enabled`,
 * moves focus into it on activation (the first tabbable element, or the
 * container itself if there isn't one), and returns focus to whatever was
 * focused before on deactivation. Safe to use on several nested containers
 * at once: each instance only intercepts Tab while focus is actually
 * inside its own container, so an inner (topmost) trap naturally takes
 * over from an outer one without any explicit stacking coordination.
 *
 * Usage:
 *   const containerRef = useRef<HTMLElement>(null)
 *   useFocusTrap({ enabled: open, containerRef })
 *   <div ref={containerRef} tabIndex={-1}>...</div>
 *
 * Depends on: nothing else in this project.
 */
import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getTabbable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

export function useFocusTrap({
  enabled,
  containerRef,
  initialFocusRef,
}: {
  enabled: boolean
  containerRef: RefObject<HTMLElement | null>
  /** Focus this element on activation instead of the first tabbable child. */
  initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    const container: HTMLElement | null = containerRef.current
    if (!container) return

    returnFocusRef.current = document.activeElement as HTMLElement | null

    const target = initialFocusRef?.current ?? getTabbable(container)[0] ?? container
    target.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (!container) return
      if (event.key !== "Tab") return
      if (!container.contains(document.activeElement)) return

      const tabbable = getTabbable(container)
      if (tabbable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = tabbable[0]
      const last = tabbable[tabbable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      const returnTo = returnFocusRef.current
      if (returnTo && document.contains(returnTo)) returnTo.focus()
    }
  }, [enabled, containerRef, initialFocusRef])
}
