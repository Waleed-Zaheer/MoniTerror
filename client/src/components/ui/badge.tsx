/**
 * Badge — a small status/label pill. Renders as a <span> by default, or
 * as whatever you pass via `render` (e.g. an <a> to make it a clickable
 * badge-link).
 *
 * Usage:
 *   <Badge variant="secondary">New</Badge>
 *   <Badge render={<a href="/x">Link badge</a>} />
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/lib/primitives/use-render.ts, merge-props.ts (the `render` prop, ref merging)
 */
import type { ComponentProps, ReactElement } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useRender } from "@/lib/primitives/use-render"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-3xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    render?: ReactElement<Record<string, unknown>>
  }) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(badgeVariants({ variant }), className),
      ...props,
    },
  })
}

export { Badge, badgeVariants }
