/**
 * Tabs — a set of layered content panels shown one at a time, switched by
 * a row (or column) of triggers. Arrow keys move focus AND switch the
 * active tab (Home/End jump to the first/last tab).
 *
 * Usage:
 *   <Tabs defaultValue="account">
 *     <TabsList>
 *       <TabsTrigger value="account">Account</TabsTrigger>
 *       <TabsTrigger value="password">Password</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="account">...</TabsContent>
 *     <TabsContent value="password">...</TabsContent>
 *   </Tabs>
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/lib/primitives/use-controllable-state.ts
 *   - src/lib/primitives/use-roving-focus.ts (arrow-key navigation + activation)
 */
import {
  createContext,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { useRovingFocus } from "@/lib/primitives/use-roving-focus"

type Orientation = "horizontal" | "vertical"

const TabsContext = createContext<{
  value: string | null
  setValue: (value: string) => void
  orientation: Orientation
  rootId: string
}>({ value: null, setValue: () => {}, orientation: "horizontal", rootId: "" })

function Tabs({
  className,
  orientation = "horizontal",
  value: valueProp,
  defaultValue,
  onValueChange,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  orientation?: Orientation
}) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
    onChange: (next) => {
      if (next !== null) onValueChange?.(next)
    },
  })
  const rootId = useId()

  return (
    <TabsContext.Provider value={{ value, setValue, orientation, rootId }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  onKeyDown,
  ...props
}: ComponentPropsWithoutRef<"div"> & VariantProps<typeof tabsListVariants>) {
  const { value, orientation } = useContext(TabsContext)
  const { containerRef, onKeyDown: onRovingKeyDown } = useRovingFocus<HTMLDivElement>({
    orientation,
    isItemActive: (el) => el.getAttribute("data-active") !== null,
    onActivate: (el) => el.click(),
    deps: [value],
  })

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-variant={variant}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        onRovingKeyDown(event)
      }}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value: triggerValue,
  disabled,
  onClick,
  ...props
}: ComponentPropsWithoutRef<"button"> & { value: string; disabled?: boolean }) {
  const { value, setValue, rootId } = useContext(TabsContext)
  const active = value === triggerValue

  return (
    <button
      type="button"
      role="tab"
      id={`${rootId}-tab-${triggerValue}`}
      aria-selected={active}
      aria-controls={`${rootId}-panel-${triggerValue}`}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-roving-item=""
      data-slot="tabs-trigger"
      data-active={active ? "" : undefined}
      data-disabled={disabled ? "true" : undefined}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && !disabled) setValue(triggerValue)
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-full border border-transparent! px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:rounded-2xl group-data-vertical/tabs:px-3 group-data-vertical/tabs:py-1.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  value: contentValue,
  ...props
}: ComponentPropsWithoutRef<"div"> & { value: string }) {
  const { value, rootId } = useContext(TabsContext)
  if (value !== contentValue) return null

  return (
    <div
      role="tabpanel"
      id={`${rootId}-panel-${contentValue}`}
      aria-labelledby={`${rootId}-tab-${contentValue}`}
      tabIndex={0}
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
