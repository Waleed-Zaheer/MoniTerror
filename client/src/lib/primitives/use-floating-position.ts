/**
 * useFloatingPosition — hand-rolled positioning for anchored floating
 * elements (tooltips, popovers, dropdowns, selects). Picks a side
 * (flipping to the opposite side if there isn't room), aligns along that
 * side, then shifts to stay inside the viewport. Tracks the anchor via
 * ResizeObserver + scroll/resize listeners so it keeps up as the page
 * moves. Exposes the same CSS custom properties the existing classNames
 * already read: --anchor-width/height, --available-width/height,
 * --transform-origin, plus data-side/data-align for styling.
 *
 * Usage:
 *   const { positionerRef, popupRef, style, side, align } = useFloatingPosition({
 *     open,
 *     anchorRef,
 *     side: "bottom",
 *     sideOffset: 4,
 *   })
 *   <div ref={positionerRef} style={style} data-side={side}>
 *     <div ref={popupRef}>...</div>
 *   </div>
 *
 * Depends on: nothing else in this project.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react"

export type FloatingSide = "top" | "bottom" | "left" | "right"
export type FloatingAlign = "start" | "center" | "end"
/** Anything with a bounding box: a real element, or a virtual point (e.g. a
 * right-click's cursor position) for components like ContextMenu that don't
 * anchor to a real trigger element. */
export type FloatingAnchor = { getBoundingClientRect(): DOMRect }

const VIEWPORT_MARGIN = 8

export function useFloatingPosition({
  open,
  anchorRef,
  side = "bottom",
  sideOffset = 0,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  alignedItemRef,
  anchorKey,
}: {
  open: boolean
  anchorRef: RefObject<FloatingAnchor | null>
  side?: FloatingSide
  sideOffset?: number
  align?: FloatingAlign
  alignOffset?: number
  /** Select-style positioning: align a specific item's text over the trigger instead of anchoring the popup edge to it. */
  alignItemWithTrigger?: boolean
  alignedItemRef?: RefObject<HTMLElement | null>
  /** Bump this (e.g. a counter) to force a reposition without an open/closed
   * transition — for anchors that can move while already open, like
   * ContextMenu's cursor point on a repeated right-click. */
  anchorKey?: unknown
}) {
  const popupRef = useRef<HTMLElement | null>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  })
  const [resolvedSide, setResolvedSide] = useState<FloatingSide>(side)
  const [resolvedAlign, setResolvedAlign] = useState<FloatingAlign>(align)

  useLayoutEffect(() => {
    if (!open) return

    function update() {
      const anchor = anchorRef.current
      const popup = popupRef.current
      if (!anchor || !popup) return

      const anchorRect = anchor.getBoundingClientRect()
      const popupRect = popup.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const spaceBelow = vh - anchorRect.bottom
      const spaceAbove = anchorRect.top
      const spaceRight = vw - anchorRect.right
      const spaceLeft = anchorRect.left

      let finalSide = side
      if (side === "bottom" && spaceBelow < popupRect.height + sideOffset && spaceAbove > spaceBelow) {
        finalSide = "top"
      } else if (side === "top" && spaceAbove < popupRect.height + sideOffset && spaceBelow > spaceAbove) {
        finalSide = "bottom"
      } else if (side === "right" && spaceRight < popupRect.width + sideOffset && spaceLeft > spaceRight) {
        finalSide = "left"
      } else if (side === "left" && spaceLeft < popupRect.width + sideOffset && spaceRight > spaceLeft) {
        finalSide = "right"
      }

      let top = 0
      let left = 0

      if (alignItemWithTrigger && alignedItemRef?.current && popup.contains(alignedItemRef.current)) {
        // Align the selected item's text baseline over the trigger, Select-style.
        const itemRect = alignedItemRef.current.getBoundingClientRect()
        const deltaTop = itemRect.top - popupRect.top
        top = anchorRect.top - deltaTop
        left = anchorRect.left
      } else {
        if (finalSide === "bottom") top = anchorRect.bottom + sideOffset
        else if (finalSide === "top") top = anchorRect.top - sideOffset - popupRect.height
        else if (finalSide === "right") left = anchorRect.right + sideOffset
        else if (finalSide === "left") left = anchorRect.left - sideOffset - popupRect.width

        if (finalSide === "bottom" || finalSide === "top") {
          if (align === "start") left = anchorRect.left + alignOffset
          else if (align === "end") left = anchorRect.right - popupRect.width - alignOffset
          else left = anchorRect.left + anchorRect.width / 2 - popupRect.width / 2 + alignOffset
        } else {
          if (align === "start") top = anchorRect.top + alignOffset
          else if (align === "end") top = anchorRect.bottom - popupRect.height - alignOffset
          else top = anchorRect.top + anchorRect.height / 2 - popupRect.height / 2 + alignOffset
        }
      }

      left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - popupRect.width - VIEWPORT_MARGIN))
      top = Math.min(Math.max(top, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vh - popupRect.height - VIEWPORT_MARGIN))

      const availableHeight =
        finalSide === "bottom"
          ? vh - anchorRect.bottom - VIEWPORT_MARGIN
          : finalSide === "top"
            ? anchorRect.top - VIEWPORT_MARGIN
            : vh - VIEWPORT_MARGIN * 2
      const availableWidth =
        finalSide === "right"
          ? vw - anchorRect.right - VIEWPORT_MARGIN
          : finalSide === "left"
            ? anchorRect.left - VIEWPORT_MARGIN
            : vw - VIEWPORT_MARGIN * 2

      const originX =
        finalSide === "left" ? "100%" : finalSide === "right" ? "0%" : `${anchorRect.left + anchorRect.width / 2 - left}px`
      const originY =
        finalSide === "top" ? "100%" : finalSide === "bottom" ? "0%" : `${anchorRect.top + anchorRect.height / 2 - top}px`

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        "--anchor-width": `${anchorRect.width}px`,
        "--anchor-height": `${anchorRect.height}px`,
        "--available-width": `${Math.max(0, availableWidth)}px`,
        "--available-height": `${Math.max(0, availableHeight)}px`,
        "--transform-origin": `${originX} ${originY}`,
      } as React.CSSProperties)
      setResolvedSide(finalSide)
      setResolvedAlign(align)
    }

    update()

    const ro = new ResizeObserver(update)
    // Virtual anchors (e.g. a right-click's cursor point) aren't real
    // elements and have nothing to resize-observe.
    if (anchorRef.current instanceof Element) ro.observe(anchorRef.current)
    if (popupRef.current) ro.observe(popupRef.current)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)

    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, sideOffset, align, alignOffset, alignItemWithTrigger, anchorKey])

  return { popupRef, style, side: resolvedSide, align: resolvedAlign }
}
