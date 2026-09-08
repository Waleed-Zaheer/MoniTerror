/**
 * useControllableState — a value that can be either controlled by the
 * parent (via a `value`/`checked`/`open`-style prop) or managed internally
 * (uncontrolled, via a `defaultValue`/`defaultChecked`/`defaultOpen` prop),
 * picked automatically based on whether the controlled prop was passed.
 *
 * Feature: this is the same controlled/uncontrolled contract every
 * interactive component in this library exposes — Accordion's `value`,
 * Dialog's `open`, Switch's `checked`, Tabs' `value`, etc. all use this
 * under the hood so both patterns work:
 *   <Switch checked={isOn} onCheckedChange={setIsOn} />        // controlled
 *   <Switch defaultChecked={true} />                            // uncontrolled
 *
 * Usage:
 *   const [open, setOpen] = useControllableState({
 *     prop: openProp,
 *     defaultProp: defaultOpen ?? false,
 *     onChange: onOpenChange,
 *   })
 *
 * Depends on: nothing else in this project.
 */
import { useCallback, useRef, useState } from "react"

export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop?: T
  defaultProp: T
  onChange?: (value: T) => void
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultProp)
  const isControlled = prop !== undefined
  const value = isControlled ? prop : uncontrolledValue

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(valueRef.current)
          : next

      if (!isControlled) setUncontrolledValue(resolved)
      if (resolved !== valueRef.current) onChangeRef.current?.(resolved)
    },
    [isControlled]
  )

  return [value, setValue]
}
