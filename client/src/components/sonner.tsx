/**
 * Sonner (Toaster) — an imperative toast/notification system (no
 * `sonner` or `next-themes` dependency). Call `toast(...)` from
 * anywhere (no provider/context needed) to push a toast into whichever
 * `<Toaster />` is mounted; a small module-scoped store connects the
 * two, exactly like the original library. Reads the app's dark/light
 * state from this project's own `theme-provider.tsx`.
 *
 * Feature scope: fully implemented and verified for the common case
 * every consumer here uses - a plain `toast(message, { description })`
 * call, default bottom-right position, the collapsed-stack/expand-on-
 * hover interaction, swipe-to-dismiss, and timed auto-dismiss (paused
 * while hovered/dragging/tab-hidden). `toast.success/info/warning/
 * error/loading`, `action`/`cancel` buttons, the close button,
 * `richColors`, other `position` values, `toast.promise`, and
 * `toast.custom` are implemented but best-effort - no demo/consumer
 * in this project exercises them. Multiple simultaneous `<Toaster/>`
 * instances (the real library's `toasterId` option) are not
 * implemented - only a single global toast stream is supported.
 *
 * Usage:
 *   // once, near the app root:
 *   <Toaster />
 *   // anywhere:
 *   toast("Snippet copied to clipboard", { description: "Paste it anywhere you like." })
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/components/theme-provider.tsx (useTheme)
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Adapted: dropped the dependency on my-snippets' own theme-provider.tsx —
// this app is dark-only (see index.css), so the toast always uses the
// dark tokens.

type ToastType = "normal" | "success" | "info" | "warning" | "error" | "loading"
type ToastPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center"

type ToastAction = {
  label: ReactNode
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
}

type ToastData = {
  id: number | string
  title?: ReactNode
  description?: ReactNode
  type?: ToastType
  icon?: ReactNode
  jsx?: ReactNode
  richColors?: boolean
  closeButton?: boolean
  dismissible?: boolean
  duration?: number
  action?: ToastAction
  cancel?: ToastAction
  onDismiss?: (toast: ToastData) => void
  onAutoClose?: (toast: ToastData) => void
  position?: ToastPosition
  className?: string
  style?: CSSProperties
}

type ExternalToast = Partial<Omit<ToastData, "id">> & { id?: number | string }

type StoreMessage = ToastData | { id: number | string; dismiss: true }
type Subscriber = (message: StoreMessage) => void

class ToastStore {
  subscribers: Subscriber[] = []
  toasts: ToastData[] = []

  subscribe(cb: Subscriber) {
    this.subscribers.push(cb)
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== cb)
    }
  }
  private publish(message: StoreMessage) {
    this.subscribers.forEach((cb) => cb(message))
  }
  upsert(toast: ToastData) {
    const existingIndex = this.toasts.findIndex((t) => t.id === toast.id)
    if (existingIndex !== -1) {
      this.toasts = this.toasts.map((t) => (t.id === toast.id ? { ...t, ...toast } : t))
    } else {
      this.toasts = [toast, ...this.toasts]
    }
    this.publish(toast)
  }
  /** Broadcasts "start removing this" - subscribers begin their exit
   * animation. The toast isn't actually dropped from `toasts` until
   * `remove()` runs, once each subscriber's animation finishes. */
  requestDismiss(id?: number | string) {
    if (id === undefined) {
      this.toasts.forEach((t) => this.publish({ id: t.id, dismiss: true }))
      return
    }
    this.publish({ id, dismiss: true })
  }
  remove(id: number | string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
  }
}

const toastStore = new ToastStore()

let toastIdCounter = 0
function generateId() {
  toastIdCounter += 1
  return toastIdCounter
}

function pushToast(message: ReactNode, data: ExternalToast | undefined, type?: ToastType) {
  const id = data?.id ?? generateId()
  toastStore.upsert({ ...data, id, title: message, type })
  return id
}

type PromiseResult<T> = ReactNode | ((data: T) => ReactNode)
type PromiseData<T> = Omit<ExternalToast, "description"> & {
  loading?: ReactNode
  success?: PromiseResult<T>
  error?: PromiseResult<unknown>
  finally?: () => void
}

const toast = Object.assign(
  (message: ReactNode, data?: ExternalToast) => pushToast(message, data),
  {
    success: (message: ReactNode, data?: ExternalToast) => pushToast(message, data, "success"),
    info: (message: ReactNode, data?: ExternalToast) => pushToast(message, data, "info"),
    warning: (message: ReactNode, data?: ExternalToast) => pushToast(message, data, "warning"),
    error: (message: ReactNode, data?: ExternalToast) => pushToast(message, data, "error"),
    loading: (message: ReactNode, data?: ExternalToast) => pushToast(message, data, "loading"),
    message: (message: ReactNode, data?: ExternalToast) => pushToast(message, data),
    custom: (jsx: (id: number | string) => ReactNode, data?: ExternalToast) => {
      const id = data?.id ?? generateId()
      toastStore.upsert({ ...data, id, jsx: jsx(id) })
      return id
    },
    dismiss: (id?: number | string) => {
      toastStore.requestDismiss(id)
      return id ?? ""
    },
    promise: <T,>(promiseOrFn: Promise<T> | (() => Promise<T>), data?: PromiseData<T>) => {
      const id = data?.id ?? generateId()
      if (data?.loading !== undefined) {
        toastStore.upsert({ ...data, id, title: data.loading, type: "loading" })
      }
      const p = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn
      p.then((result) => {
        const content = typeof data?.success === "function" ? data.success(result) : data?.success
        if (content !== undefined) toastStore.upsert({ ...data, id, title: content, type: "success", description: undefined })
      }).catch((error: unknown) => {
        const content = typeof data?.error === "function" ? data.error(error) : data?.error
        if (content !== undefined) toastStore.upsert({ ...data, id, title: content, type: "error", description: undefined })
      }).finally(() => {
        data?.finally?.()
      })
      return id
    },
  }
)

/** Standalone consumer hook - drops a toast the instant `dismiss` fires
 * (no exit animation). `<Toaster/>` does NOT use this; it needs to keep
 * a dismissed toast mounted long enough to animate out, so it manages
 * its own mirrored list instead (see `Toaster` below). */
function useSonner() {
  const [toasts, setToasts] = useState<ToastData[]>(toastStore.toasts)
  useEffect(
    () =>
      toastStore.subscribe((message) => {
        if ("dismiss" in message) {
          setToasts((prev) => prev.filter((t) => t.id !== message.id))
          return
        }
        setToasts((prev) => {
          const exists = prev.some((t) => t.id === message.id)
          return exists ? prev.map((t) => (t.id === message.id ? { ...t, ...message } : t)) : [message, ...prev]
        })
      }),
    []
  )
  return { toasts }
}

// ---------------------------------------------------------------------------
// Toaster
// ---------------------------------------------------------------------------

const DEFAULT_DURATION = 4000
const GAP = 14
const VISIBLE_TOASTS = 3
const SWIPE_THRESHOLD = 45
const SWIPE_VELOCITY_THRESHOLD = 0.11
const ENTER_EXIT_MS = 400
const SWIPE_OUT_MS = 200

type ToasterProps = {
  position?: ToastPosition
  expand?: boolean
  richColors?: boolean
  closeButton?: boolean
  duration?: number
  gap?: number
  visibleToasts?: number
  theme?: "light" | "dark"
  className?: string
  style?: CSSProperties
}

function useIsDocumentHidden() {
  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const handler = () => setHidden(document.hidden)
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])
  return hidden
}

type LocalToast = ToastData & { removed?: boolean }

function Toaster({
  position = "bottom-right",
  expand: expandByDefault = false,
  richColors = false,
  closeButton = false,
  duration = DEFAULT_DURATION,
  gap = GAP,
  visibleToasts = VISIBLE_TOASTS,
  theme: themeProp,
  className,
  style,
}: ToasterProps = {}) {
  const theme = themeProp ?? "dark"
  const [toasts, setToasts] = useState<LocalToast[]>(toastStore.toasts)
  const [expanded, setExpanded] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const isDocumentHidden = useIsDocumentHidden()
  const listRef = useRef<HTMLOListElement | null>(null)

  useEffect(
    () =>
      toastStore.subscribe((message) => {
        if ("dismiss" in message) {
          setToasts((prev) => prev.map((t) => (t.id === message.id ? { ...t, removed: true } : t)))
          return
        }
        setToasts((prev) => {
          const exists = prev.some((t) => t.id === message.id)
          return exists ? prev.map((t) => (t.id === message.id ? { ...t, ...message, removed: false } : t)) : [message, ...prev]
        })
      }),
    []
  )

  const [yPosition, xPosition] = position.split("-") as ["top" | "bottom", "left" | "right" | "center"]
  const liveToasts = toasts.filter((t) => !t.removed)
  const liveIds = liveToasts.map((t) => String(t.id))

  // The <ol> has no in-flow children (every toast is `position: absolute`,
  // needed for the collapse/expand cross-fade), so it would otherwise
  // collapse to 0x0 and never receive the hover events that drive
  // expand-on-hover / pause-on-hover - size it to match what's on screen.
  const isExpandedNow = expandByDefault || expanded
  const stackedHeight = isExpandedNow
    ? liveIds.reduce((sum, id, i) => sum + (heights[id] ?? 0) + (i > 0 ? gap : 0), 0)
    : (heights[liveIds[0]] ?? 0)

  function setToastHeight(id: number | string, height: number) {
    setHeights((prev) => (prev[String(id)] === height ? prev : { ...prev, [String(id)]: height }))
  }
  function removeToastHeight(id: number | string) {
    setHeights((prev) => {
      if (!(String(id) in prev)) return prev
      const next = { ...prev }
      delete next[String(id)]
      return next
    })
  }
  function handleExited(id: number | string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    toastStore.remove(id)
    removeToastHeight(id)
  }

  if (toasts.length === 0) return null

  return createPortal(
    <section
      aria-label="Notifications"
      className={theme === "dark" ? "dark" : undefined}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
    >
      <ol
        ref={listRef}
        data-sonner-toaster
        className={cn(
          "pointer-events-none fixed z-[999999] flex flex-col outline-none",
          yPosition === "top" ? "top-4" : "bottom-4",
          xPosition === "left" && "left-4 items-start",
          xPosition === "right" && "right-4 items-end",
          xPosition === "center" && "left-1/2 -translate-x-1/2 items-center",
          className
        )}
        style={{ width: 356, maxWidth: "calc(100vw - 2rem)", height: stackedHeight, transition: `height ${ENTER_EXIT_MS}ms ease`, ...style }}
        onMouseEnter={() => setExpanded(true)}
        onMouseMove={() => setExpanded(true)}
        onMouseLeave={() => {
          if (!interacting) setExpanded(false)
        }}
      >
        {toasts.map((t) => {
          const liveIndex = liveIds.indexOf(String(t.id))
          const index = liveIndex === -1 ? 0 : liveIndex
          return (
            <ToastItem
              key={t.id}
              toast={t}
              removed={!!t.removed}
              index={index}
              totalToasts={liveToasts.length}
              allIds={liveIds}
              heights={heights}
              setToastHeight={setToastHeight}
              yPosition={yPosition}
              xPosition={xPosition}
              gap={gap}
              expanded={expandByDefault || expanded}
              interacting={interacting}
              setInteracting={setInteracting}
              isDocumentHidden={isDocumentHidden}
              visibleToasts={visibleToasts}
              defaultDuration={duration}
              defaultRichColors={richColors}
              defaultCloseButton={closeButton}
              onExited={() => handleExited(t.id)}
            />
          )
        })}
      </ol>
    </section>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// Individual toast
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<ToastType, ReactNode> = {
  normal: null,
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin" />,
}

// Approximate - the real library ships exact per-theme hsl values baked into
// its injected stylesheet; this uses Tailwind's built-in palette instead
// since richColors isn't exercised by any consumer here.
const RICH_COLOR_CLASSES: Record<string, string> = {
  success: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-900 dark:text-green-300",
  info: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300",
  warning: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-300",
  error: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300",
}

function computeExpandedOffset(index: number, gap: number, heights: Record<string, number>, ids: string[]) {
  let offset = 0
  for (let i = 0; i < index && i < ids.length; i++) {
    offset += (heights[ids[i]] ?? 0) + gap
  }
  return offset
}

function ToastItem({
  toast: t,
  removed,
  index,
  totalToasts,
  allIds,
  heights,
  setToastHeight,
  yPosition,
  xPosition,
  gap,
  expanded,
  interacting,
  setInteracting,
  isDocumentHidden,
  visibleToasts,
  defaultDuration,
  defaultRichColors,
  defaultCloseButton,
  onExited,
}: {
  toast: LocalToast
  removed: boolean
  index: number
  totalToasts: number
  allIds: string[]
  heights: Record<string, number>
  setToastHeight: (id: number | string, height: number) => void
  yPosition: "top" | "bottom"
  xPosition: "left" | "right" | "center"
  gap: number
  expanded: boolean
  interacting: boolean
  setInteracting: (value: boolean) => void
  isDocumentHidden: boolean
  visibleToasts: number
  defaultDuration: number
  defaultRichColors: boolean
  defaultCloseButton: boolean
  onExited: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [swiping, setSwiping] = useState(false)
  const [swipedOut, setSwipedOut] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const rootRef = useRef<HTMLLIElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startTime: number; pointerId: number } | null>(null)
  const exitTimerStartedRef = useRef(false)

  const isFront = index === 0
  const isVisible = index + 1 <= visibleToasts
  const dismissible = t.dismissible !== false
  const type: ToastType = t.type ?? "normal"
  const richColors = t.richColors ?? defaultRichColors
  const closeButton = t.closeButton ?? defaultCloseButton
  const duration = t.duration ?? defaultDuration
  const lift = yPosition === "top" ? 1 : -1

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    const el = rootRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    const measure = () => setToastHeight(t.id, el.getBoundingClientRect().height)
    measure()
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure)
      observer.observe(el)
    }
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once marked removed, wait out the exit animation then tell the parent
  // to actually drop this toast from the list.
  useEffect(() => {
    if (!removed || exitTimerStartedRef.current) return
    exitTimerStartedRef.current = true
    const ms = swipedOut ? SWIPE_OUT_MS : ENTER_EXIT_MS
    const id = window.setTimeout(onExited, ms)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removed])

  function dismiss(reason: "auto" | "user") {
    if (reason === "auto") t.onAutoClose?.(t)
    else t.onDismiss?.(t)
    toastStore.requestDismiss(t.id)
  }

  // Auto-dismiss timer, pausable.
  const remainingRef = useRef(duration)
  const timerStartRef = useRef(0)
  useEffect(() => {
    if (type === "loading" || duration === Infinity || removed) return
    const paused = expanded || interacting || isDocumentHidden
    if (paused) {
      if (timerStartRef.current) remainingRef.current -= Date.now() - timerStartRef.current
      timerStartRef.current = 0
      return
    }
    timerStartRef.current = Date.now()
    const id = window.setTimeout(() => dismiss("auto"), Math.max(remainingRef.current, 0))
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, interacting, isDocumentHidden, type, duration, removed])

  function handlePointerDown(event: ReactPointerEvent<HTMLLIElement>) {
    if (!dismissible || removed) return
    if ((event.target as HTMLElement).closest("[data-button]")) return
    dragRef.current = { startX: event.clientX, startY: event.clientY, startTime: Date.now(), pointerId: event.pointerId }
    setSwiping(true)
    setInteracting(true)
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }
  function handlePointerMove(event: ReactPointerEvent<HTMLLIElement>) {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    setOffset({ x: event.clientX - drag.startX, y: event.clientY - drag.startY })
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLLIElement>) {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const { x: dx, y: dy } = offset
    const elapsed = Math.max(Date.now() - drag.startTime, 1)
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    const velocity = distance / elapsed
    dragRef.current = null
    setSwiping(false)
    setInteracting(false)
    if (distance >= SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      setSwipedOut(true)
      dismiss("user")
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }

  // Stack transform: collapsed = scaled/offset peek behind the front toast;
  // expanded = a true column using each toast's own measured height.
  let translateY: number | string
  let scale = 1
  let opacity = 1
  if (!mounted) {
    translateY = lift === -1 ? "100%" : "-100%"
    opacity = 0
  } else if (removed) {
    translateY = swipedOut ? offset.y : lift === -1 ? "100%" : "-100%"
    opacity = 0
  } else if (expanded) {
    translateY = lift * computeExpandedOffset(index, gap, heights, allIds)
  } else {
    translateY = lift * gap * index
    scale = Math.max(1 - index * 0.05, 0.85)
  }

  const swipeTransform = swiping || (removed && swipedOut) ? ` translate(${offset.x}px, ${offset.y}px)` : ""

  return (
    <li
      ref={rootRef}
      data-sonner-toast
      data-mounted={mounted}
      data-removed={removed}
      data-visible={isVisible}
      data-front={isFront}
      data-expanded={expanded}
      data-swiping={swiping}
      data-swipe-out={swipedOut}
      data-y-position={yPosition}
      data-x-position={xPosition}
      data-type={type}
      data-dismissible={dismissible}
      role={type === "error" ? "alert" : "status"}
      aria-live={isFront ? "assertive" : "polite"}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        pointerEvents: isVisible ? "auto" : "none",
        opacity,
        transform: `translateY(${typeof translateY === "number" ? `${translateY}px` : translateY}) scale(${scale})${swipeTransform}`,
        transition: swiping ? "none" : `transform ${ENTER_EXIT_MS}ms ease, opacity ${ENTER_EXIT_MS}ms ease, height ${ENTER_EXIT_MS}ms ease`,
        zIndex: totalToasts - index,
        touchAction: "none",
        ...t.style,
      }}
      className={cn(
        "pointer-events-auto absolute flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-(--border-radius) border p-4 text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
        richColors && type !== "normal" && type !== "loading" ? RICH_COLOR_CLASSES[type] : "border-(--normal-border) bg-(--normal-bg) text-(--normal-text)",
        xPosition === "right" && "right-0",
        xPosition === "left" && "left-0",
        xPosition === "center" && "left-1/2 -translate-x-1/2",
        !isVisible && "opacity-0",
        t.className
      )}
    >
      {closeButton && dismissible && (
        <button
          type="button"
          data-button
          data-close-button
          aria-label="Close toast"
          onClick={() => dismiss("user")}
          className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border border-(--normal-border) bg-(--normal-bg) text-(--normal-text) hover:bg-muted"
        >
          <XIcon className="size-3" />
        </button>
      )}

      {t.jsx ? (
        t.jsx
      ) : (
        <>
          {t.icon !== null && (t.icon || TYPE_ICONS[type]) ? (
            <div className="flex shrink-0 items-center">{t.icon ?? TYPE_ICONS[type]}</div>
          ) : null}
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="font-medium leading-normal">{t.title}</div>
            {t.description ? (
              <div className="leading-snug text-muted-foreground">{t.description}</div>
            ) : null}
          </div>
          {t.cancel ? (
            <button
              type="button"
              data-button
              data-cancel
              onClick={(event) => {
                t.cancel?.onClick(event)
                dismiss("user")
              }}
              className="ml-auto rounded bg-black/8 px-2 py-1 text-xs text-(--normal-text) dark:bg-white/30"
            >
              {t.cancel.label}
            </button>
          ) : null}
          {t.action ? (
            <button
              type="button"
              data-button
              data-action
              onClick={(event) => {
                t.action?.onClick(event)
                dismiss("user")
              }}
              className={cn("rounded bg-(--normal-text) px-2 py-1 text-xs text-(--normal-bg)", !t.cancel && "ml-auto")}
            >
              {t.action.label}
            </button>
          ) : null}
        </>
      )}
    </li>
  )
}

export { Toaster, toast, useSonner }
export type { ToastData as ToastT, ExternalToast, ToasterProps }
