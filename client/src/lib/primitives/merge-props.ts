/**
 * merge-props — combines two React prop objects into one, the way a
 * component that renders "as" a different element (via a `render` prop)
 * needs to: event handlers from both sides run (own handler first, then
 * the caller's), `className`/`style` are merged instead of overwritten,
 * and every other prop from the caller wins over the component's own.
 *
 * Feature: this is what makes `render={<Button>...</Button>}`-style
 * polymorphism work throughout this component library — see use-render.ts.
 *
 * Usage:
 *   const merged = mergeProps(ownProps, callerElement.props)
 *   const ref = mergeRefs(ownRef, (callerElement as any).ref)
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper, for className merging)
 */
import type { Ref } from "react"
import { cn } from "@/lib/utils"

type AnyProps = Record<string, unknown> & {
  className?: string
  style?: React.CSSProperties
}

const HANDLER_RE = /^on[A-Z]/

export function mergeProps<T extends AnyProps>(
  ownProps: T,
  childProps: AnyProps
): AnyProps {
  const merged: AnyProps = { ...ownProps, ...childProps }

  for (const key in childProps) {
    const ownValue = ownProps[key]
    const childValue = childProps[key]

    if (HANDLER_RE.test(key)) {
      const ownHandler = ownValue as ((...args: unknown[]) => void) | undefined
      const childHandler = childValue as
        | ((...args: unknown[]) => void)
        | undefined
      if (ownHandler && childHandler) {
        merged[key] = (...args: unknown[]) => {
          childHandler(...args)
          ownHandler(...args)
        }
      } else {
        merged[key] = childHandler ?? ownHandler
      }
    } else if (key === "className") {
      merged.className = cn(ownProps.className, childProps.className)
    } else if (key === "style") {
      merged.style = { ...ownProps.style, ...childProps.style }
    }
  }

  return merged
}

export function mergeRefs<T>(
  ...refs: (Ref<T> | undefined)[]
): (instance: T | null) => void {
  return (instance) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(instance)
      else (ref as React.MutableRefObject<T | null>).current = instance
    }
  }
}
