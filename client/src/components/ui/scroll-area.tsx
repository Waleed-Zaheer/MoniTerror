/**
 * ScrollArea — a scrollable container with a custom-styled scrollbar
 * (instead of the browser's native one) that stays in sync with real
 * scrolling and can also be dragged directly.
 *
 * Usage:
 *   <ScrollArea className="h-48">
 *     <div>...long content...</div>
 *   </ScrollArea>
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"

import { cn } from "@/lib/utils"

type Orientation = "horizontal" | "vertical"

function ScrollArea({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const viewportRef = useRef<HTMLDivElement>(null)

  return (
    <div data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <div
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        tabIndex={0}
        className="no-scrollbar size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </div>
      <ScrollBar orientation="vertical" viewportRef={viewportRef} />
      <ScrollBar orientation="horizontal" viewportRef={viewportRef} />
      <div data-slot="scroll-area-corner" />
    </div>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  viewportRef,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  orientation?: Orientation
  viewportRef: RefObject<HTMLDivElement | null>
}) {
  const isVertical = orientation === "vertical"
  const [metrics, setMetrics] = useState({ ratio: 1, offsetRatio: 0, visible: false })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function measure() {
      const el = viewportRef.current
      if (!el) return
      const scrollSize = isVertical ? el.scrollHeight : el.scrollWidth
      const clientSize = isVertical ? el.clientHeight : el.clientWidth
      const scrollOffset = isVertical ? el.scrollTop : el.scrollLeft
      const ratio = clientSize / scrollSize
      const maxOffset = scrollSize - clientSize
      setMetrics({
        ratio: Math.min(1, ratio),
        offsetRatio: maxOffset > 0 ? scrollOffset / maxOffset : 0,
        visible: ratio < 1,
      })
    }

    measure()
    viewport.addEventListener("scroll", measure)
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    for (const child of Array.from(viewport.children)) observer.observe(child)

    return () => {
      viewport.removeEventListener("scroll", measure)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVertical])

  function onThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current
    const track = event.currentTarget.parentElement
    if (!viewport || !track) return
    event.currentTarget.setPointerCapture(event.pointerId)

    const trackRect = track.getBoundingClientRect()
    const trackSize = isVertical ? trackRect.height : trackRect.width
    const scrollSize = isVertical ? viewport.scrollHeight : viewport.scrollWidth
    const clientSize = isVertical ? viewport.clientHeight : viewport.clientWidth
    const maxScroll = scrollSize - clientSize

    function onMove(moveEvent: PointerEvent) {
      const delta = isVertical ? moveEvent.movementY : moveEvent.movementX
      const scrollDelta = (delta / trackSize) * scrollSize
      if (!viewport) return
      if (isVertical) viewport.scrollTop = Math.min(maxScroll, Math.max(0, viewport.scrollTop + scrollDelta))
      else viewport.scrollLeft = Math.min(maxScroll, Math.max(0, viewport.scrollLeft + scrollDelta))
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  if (!metrics.visible) return null

  const thumbSizePercent = metrics.ratio * 100
  const thumbOffsetPercent = (1 - metrics.ratio) * metrics.offsetRatio * 100

  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        isVertical ? "absolute top-0 right-0" : "absolute bottom-0 left-0",
        className
      )}
      {...props}
    >
      <div
        data-slot="scroll-area-thumb"
        onPointerDown={onThumbPointerDown}
        style={{
          position: "relative",
          [isVertical ? "height" : "width"]: `${thumbSizePercent}%`,
          [isVertical ? "top" : "left"]: `${thumbOffsetPercent}%`,
        }}
        className="relative flex-1 rounded-full bg-border"
      />
    </div>
  )
}

export { ScrollArea, ScrollBar }
