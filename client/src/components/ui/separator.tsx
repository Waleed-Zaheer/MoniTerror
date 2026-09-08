/**
 * Separator — a thin visual (and screen-reader-accessible) divider line,
 * horizontal or vertical.
 *
 * Usage:
 *   <Separator />
 *   <Separator orientation="vertical" className="h-4" />
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 */
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type Orientation = "horizontal" | "vertical"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<"div"> & { orientation?: Orientation }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
      data-slot="separator"
      data-orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
