/**
 * usePresence — keeps an element mounted through its CSS exit animation
 * instead of disappearing the instant `open` flips to false, and reports
 * the animation phase via data-open/data-closed/data-starting-style/
 * data-ending-style attributes — the same contract the data-open:/
 * data-closed: Tailwind variants (in App.css) key off. Optionally also
 * measures the element's size into a CSS variable (e.g.
 * --accordion-panel-height) so height-auto-style open/close transitions
 * work, since CSS can't natively transition to/from `height: auto`.
 *
 * Usage:
 *   const { mounted, ref, ...presenceAttrs } = usePresence(open, {
 *     heightVar: "--accordion-panel-height",
 *   })
 *   if (!mounted) return null
 *   return <div ref={ref} {...presenceAttrs}>...</div>
 *
 * Depends on: nothing else in this project.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"

type Phase = "starting" | "open" | "closing"

export function usePresence(
  open: boolean,
  options?: { heightVar?: string; widthVar?: string }
) {
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closing")
  const ref = useRef<HTMLElement | null>(null)
  const isFirstRender = useRef(true)

  useLayoutEffect(() => {
    if (open) {
      setMounted(true)
      if (isFirstRender.current) {
        setPhase("open")
      } else {
        setPhase("starting")
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setPhase("open"))
        })
      }
    } else if (!isFirstRender.current) {
      setPhase("closing")
    }
    isFirstRender.current = false
  }, [open])

  // Unmount only after any CSS animation/transition triggered by the
  // data-closed/data-ending-style flip has actually finished playing.
  useEffect(() => {
    if (phase !== "closing") return
    const el = ref.current
    if (!el || typeof el.getAnimations !== "function") {
      setMounted(false)
      return
    }
    const animations = el.getAnimations()
    if (animations.length === 0) {
      setMounted(false)
      return
    }
    let cancelled = false
    Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() => {
      if (!cancelled) setMounted(false)
    })
    return () => {
      cancelled = true
    }
  }, [phase])

  const heightVar = options?.heightVar
  const widthVar = options?.widthVar

  useLayoutEffect(() => {
    if (!mounted || (!heightVar && !widthVar)) return
    const el = ref.current
    if (!el) return

    function measure() {
      if (!el) return
      if (heightVar) el.style.setProperty(heightVar, `${el.scrollHeight}px`)
      if (widthVar) el.style.setProperty(widthVar, `${el.scrollWidth}px`)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [mounted, heightVar, widthVar])

  return {
    mounted,
    ref,
    "data-open": phase === "starting" || phase === "open" ? "" : undefined,
    "data-closed": phase === "closing" ? "" : undefined,
    "data-starting-style": phase === "starting" ? "" : undefined,
    "data-ending-style": phase === "closing" ? "" : undefined,
  } as const
}
