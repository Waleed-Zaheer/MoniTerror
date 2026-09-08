/**
 * Tooltip — a small floating label shown when hovering or focusing a
 * trigger element. Wrap a tree in one TooltipProvider so consecutive
 * tooltips share timing: hovering straight from one trigger to another
 * opens the second instantly (no re-delay), but hovering after a pause
 * incurs the full delay again.
 *
 * Usage:
 *   <TooltipProvider>
 *     <Tooltip>
 *       <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
 *       <TooltipContent>Add to favorites</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/lib/primitives/use-controllable-state.ts
 *   - src/lib/primitives/use-render.ts (the `render` prop)
 *   - src/lib/primitives/use-presence.ts (exit animation)
 *   - src/lib/primitives/use-floating-position.ts (anchored positioning)
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { useRender } from "@/lib/primitives/use-render"
import { usePresence } from "@/lib/primitives/use-presence"
import {
  useFloatingPosition,
  type FloatingAlign,
  type FloatingSide,
} from "@/lib/primitives/use-floating-position"

const SKIP_DELAY_MS = 300

const TooltipGroupContext = createContext<{
  delay: number
  closeDelay: number
  lastCloseTimeRef: { current: number }
}>({ delay: 0, closeDelay: 0, lastCloseTimeRef: { current: 0 } })

function TooltipProvider({
  delay = 0,
  closeDelay = 0,
  children,
}: {
  delay?: number
  closeDelay?: number
  children?: ReactNode
}) {
  const lastCloseTimeRef = useRef(0)
  return (
    <TooltipGroupContext.Provider value={{ delay, closeDelay, lastCloseTimeRef }}>
      {children}
    </TooltipGroupContext.Provider>
  )
}

const TooltipContext = createContext<{
  open: boolean
  requestOpen: () => void
  requestClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  triggerId: string
}>({
  open: false,
  requestOpen: () => {},
  requestClose: () => {},
  triggerRef: { current: null },
  triggerId: "",
})

function Tooltip({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = useRef<HTMLElement | null>(null)
  const triggerId = useId()
  const openTimerRef = useRef<number | undefined>(undefined)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const { delay, closeDelay, lastCloseTimeRef } = useContext(TooltipGroupContext)

  useEffect(() => {
    return () => {
      window.clearTimeout(openTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function requestOpen() {
    window.clearTimeout(closeTimerRef.current)
    const skipDelay = Date.now() - lastCloseTimeRef.current < SKIP_DELAY_MS
    if (skipDelay || delay === 0) {
      setOpen(true)
    } else {
      openTimerRef.current = window.setTimeout(() => setOpen(true), delay)
    }
  }

  function requestClose() {
    window.clearTimeout(openTimerRef.current)
    if (closeDelay === 0) {
      setOpen(false)
      lastCloseTimeRef.current = Date.now()
    } else {
      closeTimerRef.current = window.setTimeout(() => {
        setOpen(false)
        lastCloseTimeRef.current = Date.now()
      }, closeDelay)
    }
  }

  return (
    <TooltipContext.Provider value={{ open, requestOpen, requestClose, triggerRef, triggerId }}>
      {children}
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  render,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  render?: ReactElement<Record<string, unknown>>
}) {
  const { open, requestOpen, requestClose, triggerRef, triggerId } = useContext(TooltipContext)

  return useRender({
    render,
    ref: triggerRef,
    defaultTagName: "button",
    props: {
      id: triggerId,
      type: render ? undefined : "button",
      "data-slot": "tooltip-trigger",
      "aria-describedby": open ? `${triggerId}-content` : undefined,
      onMouseEnter: requestOpen,
      onMouseLeave: requestClose,
      onFocus: requestOpen,
      onBlur: requestClose,
      ...props,
    },
  })
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  side?: FloatingSide
  sideOffset?: number
  align?: FloatingAlign
  alignOffset?: number
}) {
  const { open, triggerRef, triggerId } = useContext(TooltipContext)
  const { mounted, ref: presenceRef, ...presenceAttrs } = usePresence(open)
  const { popupRef, style, side: resolvedSide } = useFloatingPosition({
    open: mounted,
    anchorRef: triggerRef,
    side,
    sideOffset,
    align,
    alignOffset,
  })

  if (!mounted) return null

  return createPortal(
    <div
      ref={popupRef as React.Ref<HTMLDivElement>}
      style={style}
      data-side={resolvedSide}
      className="isolate z-50"
    >
      <div
        ref={presenceRef as React.Ref<HTMLDivElement>}
        id={`${triggerId}-content`}
        role="tooltip"
        data-slot="tooltip-content"
        data-side={resolvedSide}
        {...presenceAttrs}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <div
          data-side={resolvedSide}
          className="absolute z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:translate-x-[-1.5px] data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:translate-x-[1.5px] data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5"
        />
      </div>
    </div>,
    document.body
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
