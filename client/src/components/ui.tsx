import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Category } from '../types';
import { IconAlertTriangle, IconCheck, IconInfo, IconX } from './icons';

/* ------------------------------ Card ------------------------------ */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white/[0.03] ring-1 ring-white/10 backdrop-blur-sm shadow-lg shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------ Button ------------------------------ */
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'warn';
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-500 text-white ring-1 ring-brand-500/50',
  ghost: 'bg-white/5 hover:bg-white/10 text-slate-200 ring-1 ring-white/10',
  danger: 'bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-300 ring-1 ring-rose-500/30',
  warn: 'bg-amber-400 hover:bg-amber-300 text-amber-950 ring-1 ring-amber-400/50',
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
  const sizeCls = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition
        active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls} ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Badge ------------------------------ */
const CATEGORY_STYLES: Record<Category, string> = {
  system: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  dev: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  'background-app': 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  browser: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  editor: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  other: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
};
const CATEGORY_LABELS: Record<Category, string> = {
  system: 'System',
  dev: 'Dev',
  'background-app': 'Background',
  browser: 'Browser',
  editor: 'Editor',
  other: 'Other',
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${CATEGORY_STYLES[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${className}`}>
      {children}
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
        className={`relative h-5.5 w-10 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-white/15'}`}
        style={{ height: '1.375rem', width: '2.5rem' }}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </span>
      <span className="text-sm text-slate-400">{label}</span>
    </label>
  );
}

/* ------------------------------ Spinner ------------------------------ */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`}
      style={{ width: '0.85rem', height: '0.85rem' }}
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
            className={`animate-fade-up flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ring-1 backdrop-blur
              ${t.kind === 'error'
                ? 'bg-rose-950/85 text-rose-200 ring-rose-500/40'
                : 'bg-slate-900/90 text-slate-100 ring-white/10'}`}
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
  danger: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  warn: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  primary: 'bg-brand-500/15 text-brand-400 ring-brand-500/30',
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm animate-fade-up rounded-2xl bg-slate-900 p-5 ring-1 ring-white/10 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start gap-3.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ${DIALOG_ICON_STYLES[variant]}`}>
                {variant === 'primary' ? <IconInfo className="h-5 w-5" /> : <IconAlertTriangle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div id="confirm-dialog-title" className="text-[15px] font-bold text-slate-50">
                  {state.title}
                </div>
                {state.description && (
                  <div className="mt-1.5 text-sm leading-relaxed text-slate-400">{state.description}</div>
                )}
              </div>
              <button
                onClick={() => close(false)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
                aria-label="Cancel"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
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
