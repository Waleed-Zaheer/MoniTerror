/**
 * AlertDialog — a modal that interrupts the user for a required decision
 * (e.g. confirming a destructive action). Like Dialog, but always modal
 * and can only be closed via Escape or an explicit action/cancel button -
 * clicking the backdrop does nothing, since the whole point is to force a
 * deliberate choice. Otherwise a fully independent file (no import from
 * dialog.tsx) so it can be copied on its own.
 *
 * Usage:
 *   <AlertDialog>
 *     <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogTitle>Are you sure?</AlertDialogTitle>
 *         <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel>Cancel</AlertDialogCancel>
 *         <AlertDialogAction variant="destructive">Continue</AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialog>
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/lib/primitives/use-controllable-state.ts
 *   - src/lib/primitives/use-render.ts, merge-props.ts (the `render` prop, ref merging)
 *   - src/lib/primitives/use-presence.ts (exit animation)
 *   - src/lib/primitives/use-focus-trap.ts (Tab cycling, initial/return focus)
 *   - src/lib/primitives/use-scroll-lock.ts (locks page scroll while open)
 *   - src/lib/primitives/use-modal-stack.ts (only the topmost of nested dialogs dismisses)
 *   - src/lib/primitives/use-dismiss.ts (Escape to close - outside click intentionally does nothing)
 *   - src/components/ui/button.tsx (AlertDialogAction/Cancel are styled Buttons)
 */
import {
  createContext,
  useContext,
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
import { mergeRefs } from "@/lib/primitives/merge-props"
import { usePresence } from "@/lib/primitives/use-presence"
import { useFocusTrap } from "@/lib/primitives/use-focus-trap"
import { useScrollLock } from "@/lib/primitives/use-scroll-lock"
import { useModalStack } from "@/lib/primitives/use-modal-stack"
import { useDismiss } from "@/lib/primitives/use-dismiss"
import { Button } from "@/components/ui/button"

const AlertDialogContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  titleId: string
  descriptionId: string
}>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  titleId: "",
  descriptionId: "",
})

function AlertDialog({
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
  const titleId = useId()
  const descriptionId = useId()

  return (
    <AlertDialogContext.Provider value={{ open, setOpen, triggerRef, titleId, descriptionId }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

function AlertDialogTrigger({
  render,
  onClick,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  render?: ReactElement<Record<string, unknown>>
}) {
  const { open, setOpen, triggerRef } = useContext(AlertDialogContext)
  return useRender({
    render,
    ref: triggerRef,
    defaultTagName: "button",
    props: {
      type: render ? undefined : "button",
      "data-slot": "alert-dialog-trigger",
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: (event: React.MouseEvent) => {
        onClick?.(event as React.MouseEvent<HTMLButtonElement>)
        if (!event.defaultPrevented) setOpen(true)
      },
      ...props,
    },
  })
}

function AlertDialogPortal({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

function AlertDialogOverlay({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  onKeyDown,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  size?: "default" | "sm"
}) {
  const { open, setOpen, titleId, descriptionId } = useContext(AlertDialogContext)
  const { mounted, ref: presenceRef, ...presenceAttrs } = usePresence(open)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isTopmost = useModalStack(open)

  useScrollLock(open)
  useFocusTrap({ enabled: mounted, containerRef })
  useDismiss({
    open,
    active: isTopmost,
    outsideClick: false,
    onDismiss: () => setOpen(false),
    refs: [containerRef],
  })

  if (!mounted) return null

  return createPortal(
    <>
      <AlertDialogOverlay {...presenceAttrs} />
      <div
        ref={mergeRefs(presenceRef as React.Ref<HTMLDivElement>, containerRef)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-slot="alert-dialog-content"
        data-size={size}
        tabIndex={-1}
        {...presenceAttrs}
        onKeyDown={onKeyDown}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-md dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </>,
    document.body
  )
}

function AlertDialogHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-full bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, id, ...props }: ComponentPropsWithoutRef<"h2">) {
  const { titleId } = useContext(AlertDialogContext)
  return (
    <h2
      id={id ?? titleId}
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-lg font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  id,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  const { descriptionId } = useContext(AlertDialogContext)
  return (
    <p
      id={id ?? descriptionId}
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: ComponentPropsWithoutRef<typeof Button>) {
  return <Button data-slot="alert-dialog-action" className={cn(className)} {...props} />
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: ComponentPropsWithoutRef<typeof Button>) {
  const { setOpen } = useContext(AlertDialogContext)
  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) setOpen(false)
      }}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
