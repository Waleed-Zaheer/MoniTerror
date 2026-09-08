/**
 * useModalStack — tracks a global stack of open modals (dialogs, alert
 * dialogs, sheets, drawers) and reports whether a given instance is the
 * topmost one. Used to make sure that when one modal opens another, only
 * the top one responds to Escape and outside-click dismissal - pressing
 * Escape with two dialogs open closes just the front one, not both.
 *
 * Usage:
 *   const isTopmost = useModalStack(open)
 *   useDismiss({ open, active: isTopmost, onDismiss: () => setOpen(false), refs: [popupRef] })
 *
 * Depends on: nothing else in this project.
 */
import { useEffect, useRef, useSyncExternalStore } from "react"

const stack: symbol[] = []
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) listener()
}

export function useModalStack(active: boolean): boolean {
  const idRef = useRef<symbol | undefined>(undefined)
  idRef.current ??= Symbol("modal")

  useEffect(() => {
    if (!active) return
    const id = idRef.current!
    stack.push(id)
    notify()
    return () => {
      const index = stack.indexOf(id)
      if (index !== -1) stack.splice(index, 1)
      notify()
    }
  }, [active])

  return useSyncExternalStore(
    subscribe,
    () => active && stack.length > 0 && stack[stack.length - 1] === idRef.current
  )
}
