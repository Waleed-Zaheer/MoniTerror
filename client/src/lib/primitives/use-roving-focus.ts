/**
 * useRovingFocus — arrow-key navigation between a set of focusable items in
 * a group (radio buttons, toggle-group buttons, tabs, menu items), where
 * real DOM focus moves between items and only ONE item is in the natural
 * Tab order at a time (the "roving tabindex" pattern). Home/End jump to
 * the first/last item.
 *
 * Feature: this is the "real focus moves" model — contrast with a listbox
 * like Select/Combobox where focus stays on one input and only a
 * `data-highlighted` attribute moves (a different pattern, not built on
 * this hook).
 *
 * Usage:
 *   const { containerRef, onKeyDown } = useRovingFocus({
 *     orientation: "horizontal",
 *     isItemActive: (el) => el.getAttribute("data-pressed") !== null,
 *     deps: [values], // re-run the tabindex pass whenever selection changes
 *     onActivate: (el) => el.click(), // e.g. radio groups select on arrow-move
 *   })
 *   <div ref={containerRef} onKeyDown={onKeyDown}>
 *     <button data-roving-item>...</button>
 *   </div>
 *
 * Depends on: nothing else in this project.
 */
import { useEffect, useRef, type DependencyList, type KeyboardEvent } from "react"

export function useRovingFocus<T extends HTMLElement>({
  orientation = "horizontal",
  loop = true,
  onActivate,
  isItemActive,
  deps = [],
}: {
  orientation?: "horizontal" | "vertical" | "both"
  loop?: boolean
  /** Called with the newly focused item, e.g. to also select it. */
  onActivate?: (element: HTMLElement) => void
  /** Which item should be the sole Tab stop; defaults to the first item. */
  isItemActive?: (element: HTMLElement) => boolean
  /** Re-run the tabindex assignment when these change (e.g. selected value). */
  deps?: DependencyList
} = {}) {
  const containerRef = useRef<T>(null)

  function getItems(): HTMLElement[] {
    const container = containerRef.current
    if (!container) return []
    return Array.from(
      container.querySelectorAll<HTMLElement>("[data-roving-item]")
    ).filter(
      (el) => el.getAttribute("data-disabled") !== "true" && !el.hasAttribute("disabled")
    )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const items = getItems()
    if (items.length === 0) return
    const activeItem = (isItemActive && items.find(isItemActive)) || items[0]
    for (const item of items) {
      item.tabIndex = item === activeItem ? 0 : -1
    }
  }, deps)

  function onKeyDown(event: KeyboardEvent) {
    const items = getItems()
    if (items.length === 0) return

    let currentIndex = items.indexOf(document.activeElement as HTMLElement)
    // Focus can be elsewhere (e.g. inside a portaled popup one of these
    // items opened) - fall back to whichever item is semantically active
    // instead of always defaulting to the first item.
    if (currentIndex === -1 && isItemActive) {
      currentIndex = items.findIndex(isItemActive)
    }

    const isNext =
      (orientation !== "vertical" && event.key === "ArrowRight") ||
      (orientation !== "horizontal" && event.key === "ArrowDown")
    const isPrev =
      (orientation !== "vertical" && event.key === "ArrowLeft") ||
      (orientation !== "horizontal" && event.key === "ArrowUp")
    const isFirst = event.key === "Home"
    const isLast = event.key === "End"

    if (!isNext && !isPrev && !isFirst && !isLast) return
    event.preventDefault()

    let nextIndex: number
    if (isFirst) nextIndex = 0
    else if (isLast) nextIndex = items.length - 1
    else if (currentIndex === -1) nextIndex = 0
    else {
      const raw = currentIndex + (isNext ? 1 : -1)
      nextIndex = loop
        ? (raw + items.length) % items.length
        : Math.min(Math.max(raw, 0), items.length - 1)
    }

    const nextItem = items[nextIndex]
    if (!nextItem) return
    nextItem.tabIndex = 0
    for (const item of items) if (item !== nextItem) item.tabIndex = -1
    nextItem.focus()
    onActivate?.(nextItem)
  }

  return { containerRef, onKeyDown }
}
