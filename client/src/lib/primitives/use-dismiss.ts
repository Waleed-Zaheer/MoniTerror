/**
 * useDismiss — closes an open floating element (popover, select, menu)
 * when the user clicks outside it or presses Escape. Shared by anything
 * that opens on click and should close on outside interaction (unlike
 * Tooltip/HoverCard, which close on pointer-out instead).
 *
 * Usage:
 *   useDismiss({
 *     open,
 *     onDismiss: () => setOpen(false),
 *     refs: [triggerRef, popupRef],
 *   })
 *
 *   // Stacked modals (see use-modal-stack.ts): only the topmost should
 *   // dismiss on Escape/outside-click.
 *   useDismiss({ open, active: isTopmost, onDismiss, refs: [popupRef] })
 *
 * Depends on: nothing else in this project.
 */
import { useEffect, type RefObject } from "react"

export function useDismiss({
  open,
  active = true,
  outsideClick = true,
  onDismiss,
  refs,
}: {
  open: boolean
  /** Set false to keep listening for `open` but skip acting - e.g. a
   * background dialog while a nested one is on top of it. */
  active?: boolean
  /** Set false to keep Escape-to-dismiss but not outside-click - e.g.
   * AlertDialog, which requires an explicit action to close. */
  outsideClick?: boolean
  onDismiss: () => void
  refs: RefObject<HTMLElement | null>[]
}) {
  useEffect(() => {
    if (!open || !active) return

    function isInside(target: EventTarget | null) {
      if (!(target instanceof Node)) return false
      return refs.some((ref) => ref.current?.contains(target))
    }

    function onPointerDown(event: PointerEvent) {
      if (!outsideClick) return
      if (!isInside(event.target)) onDismiss()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])
}
