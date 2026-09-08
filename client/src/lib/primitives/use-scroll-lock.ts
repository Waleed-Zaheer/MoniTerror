/**
 * useScrollLock — locks page scroll while `enabled`, refcounted so several
 * nested modals (a dialog opening another dialog) can each request the
 * lock independently without fighting over who releases it - scroll only
 * unlocks once the last one releases. Relies on `scrollbar-gutter: stable`
 * being set globally (this project sets it in App.css via the inlined
 * shadcn base styles), so hiding the scrollbar never shifts layout - this
 * is a deliberately simplified version of the original's scroll lock,
 * which additionally special-cased browsers/platforms that don't support
 * `scrollbar-gutter` (older Safari, overlay-scrollbar iOS) with manual
 * width/height compensation. Not reimplemented here since this project
 * already guarantees the stable-gutter path everywhere.
 *
 * Usage:
 *   useScrollLock(open)
 *
 * Depends on: nothing else in this project (assumes App.css's global
 * `scrollbar-gutter: stable`).
 */
import { useEffect } from "react"

let lockCount = 0
let originalOverflow = ""

export function useScrollLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    lockCount += 1
    if (lockCount === 1) {
      const html = document.documentElement
      originalOverflow = html.style.overflow
      html.style.overflow = "hidden"
    }

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.documentElement.style.overflow = originalOverflow
      }
    }
  }, [enabled])
}
