import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Category } from '../types';
import { IconAlertTriangle, IconCheck, IconInfo, IconX } from './icons';

/* ------------------------------ Card ------------------------------ */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------ Button ------------------------------ */
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'warn';
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-400 text-white',
  ghost: 'bg-transparent hover:bg-white/[0.06] text-slate-300 border border-line hover:border-line-strong',
  danger: 'bg-transparent text-rose-400 border border-rose-500/25 hover:bg-rose-500 hover:text-white hover:border-rose-500',
  warn: 'bg-amber-400 hover:bg-amber-300 text-amber-950',
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
  const sizeCls = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]';
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors
        active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls} ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Category indicator ------------------------------ */
// A small color dot instead of a full badge pill — the goal is to carry the
// same information at a fraction of the visual weight, since it repeats on
// every table row.
const CATEGORY_DOT: Record<Category, string> = {
  system: 'bg-rose-400',
  dev: 'bg-brand-400',
  'background-app': 'bg-amber-400',
  browser: 'bg-cyan-400',
  editor: 'bg-violet-400',
  other: 'bg-slate-500',
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
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[category]}`} />
      {showLabel && CATEGORY_LABELS[category]}
    </span>
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
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5">
      <span
        onClick={() => onChange(!checked)}
        className={`relative rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-white/12'}`}
        style={{ height: '1.25rem', width: '2.125rem' }}
      >
        <span
          className={`absolute top-0.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.75' : 'translate-x-0.5'}`}
          style={{ height: '1rem', width: '1rem' }}
        />
      </span>
      <span className="text-[13px] text-slate-400">{label}</span>
    </label>
  );
}

/* ------------------------------ Spinner ------------------------------ */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/25 border-t-white ${className}`}
      style={{ width: '0.8rem', height: '0.8rem' }}
    />
  );
}

/* ------------------------------ Toast ------------------------------ */
interface ToastMsg { id: number; text: string; kind: 'ok' | 'error'; }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

let toastSeq = 1;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium shadow-lg shadow-black/40
              ${t.kind === 'error'
                ? 'border-rose-500/30 bg-[#1a0d0f] text-rose-200'
                : 'border-line-strong bg-surface-2 text-slate-100'}`}
          >
            <span className={t.kind === 'error' ? 'text-rose-400' : 'text-emerald-400'}>
              {t.kind === 'error' ? <IconAlertTriangle className="h-4 w-4" /> : <IconCheck className="h-4 w-4" />}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
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

const DIALOG_ICON_STYLES: Record<NonNullable<ConfirmOptions['variant']>, string> = {
  danger: 'bg-rose-500/12 text-rose-400',
  warn: 'bg-amber-500/12 text-amber-400',
  primary: 'bg-brand-500/12 text-brand-400',
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

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  const variant = state?.variant ?? 'primary';

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm animate-fade-up rounded-xl border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start gap-3.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${DIALOG_ICON_STYLES[variant]}`}>
                {variant === 'primary' ? <IconInfo className="h-4.5 w-4.5" /> : <IconAlertTriangle className="h-4.5 w-4.5" />}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div id="confirm-dialog-title" className="text-sm font-semibold text-slate-50">
                  {state.title}
                </div>
                {state.description && (
                  <div className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{state.description}</div>
                )}
              </div>
              <button
                onClick={() => close(false)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
                aria-label="Cancel"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>{state.cancelLabel ?? 'Cancel'}</Button>
              <Button variant={variant} onClick={() => close(true)} autoFocus>
                {state.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
