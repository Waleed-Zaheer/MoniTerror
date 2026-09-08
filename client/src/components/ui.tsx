import { createContext, useCallback, useContext, useId, useState, type ReactNode } from 'react';
import type { Category } from '../types';
import { cn } from '../lib/utils';
import { IconAlertTriangle, IconInfo } from './icons';
import { Button as SnippetButton } from './ui/button';
import { Switch } from './ui/switch';
import { Spinner as SnippetSpinner } from './ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast as sonnerToast } from './sonner';

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
export { Badge } from './ui/badge';
export { Input } from './ui/input';
export { Separator } from './ui/separator';
export { Toaster } from './sonner';
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from './ui/empty';

/* ------------------------------ Card ------------------------------ */
// Lighter than my-snippets' own Card (which bakes in vertical padding meant
// to pair with a CardContent slot) — every call site here already manages
// its own padding, so this keeps that contract unchanged while picking up
// the new token colors/radius.
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-border bg-card shadow-sm', className)}>{children}</div>;
}

/* ------------------------------ Button ------------------------------ */
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'warn';
const VARIANT_MAP: Record<ButtonVariant, 'default' | 'ghost' | 'destructive'> = {
  primary: 'default',
  ghost: 'ghost',
  danger: 'destructive',
  warn: 'default',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <SnippetButton
      variant={VARIANT_MAP[variant]}
      size={size === 'sm' ? 'sm' : 'default'}
      className={cn(variant === 'warn' && 'bg-warning text-warning-foreground hover:bg-warning/85', className)}
      {...props}
    >
      {children}
    </SnippetButton>
  );
}

/* ------------------------------ Category indicator ------------------------------ */
// A small color dot instead of a full badge pill — the goal is to carry the
// same information at a fraction of the visual weight, since it repeats on
// every table row.
const CATEGORY_DOT: Record<Category, string> = {
  system: 'bg-rose-400',
  dev: 'bg-primary',
  'background-app': 'bg-warning',
  browser: 'bg-cyan-400',
  editor: 'bg-violet-400',
  other: 'bg-muted-foreground',
};
export const CATEGORY_LABELS: Record<Category, string> = {
  system: 'System',
  dev: 'Dev',
  'background-app': 'Background',
  browser: 'Browser',
  editor: 'Editor',
  other: 'Other',
};

export function CategoryDot({ category, showLabel = true }: { category: Category; showLabel?: boolean }) {
  const dot = <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', CATEGORY_DOT[category])} />;
  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot}
        {CATEGORY_LABELS[category]}
      </span>
    );
  }
  // No visible label (dense table cells) — keep the category discoverable
  // on hover/focus instead of dropping the information entirely.
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-default items-center" tabIndex={0} />}>{dot}</TooltipTrigger>
      <TooltipContent>{CATEGORY_LABELS[category]}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------ Toggle switch ------------------------------ */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer select-none items-center gap-2.5">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </label>
  );
}

/* ------------------------------ Spinner ------------------------------ */
export function Spinner({ className = '' }: { className?: string }) {
  return <SnippetSpinner className={cn('size-3.5', className)} />;
}

/* ------------------------------ Toast ------------------------------ */
// Sonner's toast() is a module-level singleton (no provider/context needed)
// — useToast() stays a hook for call-site compatibility, but ToastProvider
// is now just a pass-through; mount <Toaster /> once near the app root.
export function useToast() {
  return useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    if (kind === 'error') sonnerToast.error(text);
    else sonnerToast.success(text);
  }, []);
}
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------ Confirm dialog ------------------------------ */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warn' | 'primary';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

const DIALOG_MEDIA_STYLES: Record<NonNullable<ConfirmOptions['variant']>, string> = {
  danger: 'bg-destructive/12 text-destructive',
  warn: 'bg-warning/15 text-warning',
  primary: 'bg-primary/12 text-primary',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const close = useCallback((result: boolean) => {
    setState((s) => {
      s?.resolve(result);
      return null;
    });
  }, []);

  const variant = state?.variant ?? 'primary';

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {/* Controlled by `state` — AlertDialog handles focus trap, scroll
         lock, and Escape-to-cancel; unlike the app's other surfaces, an
         outside click intentionally does nothing here (this dialog exists
         specifically to force a deliberate choice on a destructive action). */}
      <AlertDialog open={state !== null} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className={DIALOG_MEDIA_STYLES[variant]}>
              {variant === 'primary' ? <IconInfo className="h-6 w-6" /> : <IconAlertTriangle className="h-6 w-6" />}
            </AlertDialogMedia>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{state?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              variant={variant === 'danger' ? 'destructive' : 'default'}
              className={variant === 'warn' ? 'bg-warning text-warning-foreground hover:bg-warning/85' : undefined}
              onClick={() => close(true)}
              autoFocus
            >
              {state?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}
