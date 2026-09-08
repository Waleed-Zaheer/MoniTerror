/**
 * useRender — lets a component render as a different element than its
 * default, by passing `render={<a href="/x">...</a>}` instead of children.
 * The component's own behavior props (event handlers, data- and aria-
 * attributes, className, ref) get merged onto whichever element you passed
 * in, instead of the component wrapping it in an extra DOM node.
 *
 * This is the "render prop" pattern used across this whole component
 * library, e.g.:
 *   <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
 * renders a single <button> that is both a styled Button AND a working
 * tooltip trigger — no wrapper element, no duplicate button.
 *
 * Feature: only the *element* form of `render` is supported (not a
 * render-function). Every component in this project only ever needs that
 * form.
 *
 * Usage (inside a component you're building):
 *   function MyTrigger({ render, ...props }) {
 *     return useRender({ render, props: { "data-slot": "my-trigger", ...props }, defaultTagName: "button" })
 *   }
 *
 * Depends on:
 *   - src/lib/primitives/merge-props.ts (mergeProps, mergeRefs)
 */
import { cloneElement, createElement, isValidElement } from "react"
import type { ReactElement, Ref } from "react"
import { mergeProps, mergeRefs } from "@/lib/primitives/merge-props"

type RenderableProps = Record<string, unknown> & {
  className?: string
  style?: React.CSSProperties
}

export function useRender<T extends RenderableProps>({
  render,
  props,
  ref,
  defaultTagName = "div",
}: {
  render?: ReactElement<RenderableProps> | false | null
  props: T
  ref?: Ref<unknown>
  defaultTagName?: keyof React.JSX.IntrinsicElements
}) {
  if (render && isValidElement(render)) {
    const elementRef = (render as unknown as { ref?: Ref<unknown> }).ref
    const merged = mergeProps(props, render.props as RenderableProps)
    return cloneElement(render, {
      ...merged,
      ref: ref ? mergeRefs(ref, elementRef) : elementRef,
    } as RenderableProps)
  }

  return createElement(defaultTagName, { ...props, ref })
}
