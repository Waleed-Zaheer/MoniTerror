/**
 * Switch — an on/off toggle control (role="switch"), with a hidden
 * checkbox input alongside it so it still participates in HTML forms.
 *
 * Usage:
 *   <Switch defaultChecked />
 *   <Switch checked={isOn} onCheckedChange={setIsOn} />
 *
 * Depends on:
 *   - src/lib/utils.ts (cn helper)
 *   - src/lib/primitives/use-controllable-state.ts
 */
import type { ComponentPropsWithoutRef, KeyboardEvent, Ref } from "react"

import { cn } from "@/lib/utils"
import { useControllableState } from "@/lib/primitives/use-controllable-state"

function Switch({
  className,
  size = "default",
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  readOnly = false,
  required,
  name,
  form,
  value = "on",
  inputRef,
  id,
  onClick,
  onKeyDown,
  ...props
}: Omit<ComponentPropsWithoutRef<"span">, "onChange"> & {
  size?: "sm" | "default"
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  form?: string
  value?: string
  inputRef?: Ref<HTMLInputElement>
}) {
  const [checked, setChecked] = useControllableState({
    prop: checkedProp,
    defaultProp: defaultChecked,
    onChange: onCheckedChange,
  })

  function toggle() {
    if (disabled || readOnly) return
    setChecked(!checked)
  }

  return (
    <>
      <span
        role="switch"
        id={id}
        aria-checked={checked}
        aria-readonly={readOnly || undefined}
        aria-required={required || undefined}
        tabIndex={disabled ? undefined : 0}
        data-slot="switch"
        data-size={size}
        data-checked={checked ? "" : undefined}
        data-unchecked={!checked ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) toggle()
        }}
        onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault()
            toggle()
          }
        }}
        className={cn(
          "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-5 data-[size=default]:w-11 data-[size=sm]:h-4 data-[size=sm]:w-7 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-unchecked:border-transparent data-unchecked:bg-input/90 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span
          data-slot="switch-thumb"
          className="pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-6 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-4 data-checked:translate-x-[calc(100%-8px)] dark:data-checked:bg-primary-foreground data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
          data-checked={checked ? "" : undefined}
          data-unchecked={!checked ? "" : undefined}
        />
      </span>
      <input
        type="checkbox"
        ref={inputRef}
        checked={checked}
        onChange={() => {}}
        name={name}
        form={form}
        value={value}
        required={required}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      />
    </>
  )
}

export { Switch }
