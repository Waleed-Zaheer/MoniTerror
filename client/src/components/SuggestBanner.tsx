import { Button } from './ui';
import { fmtBytes } from '../api';
import type { Overview } from '../types';

export function SuggestBanner({
  overview,
  onCloseAll,
  busy,
}: {
  overview: Overview;
  onCloseAll: () => void;
  busy: boolean;
}) {
  const { closeable } = overview;
  if (closeable.count === 0) return null;

  return (
    <div className="mb-5 flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-amber-500/15 to-transparent p-4 ring-1 ring-amber-500/40 sm:flex-row sm:items-center">
      <div className="text-2xl">💡</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-amber-100">
          You can likely free ~{fmtBytes(closeable.totalMemBytes)} — {closeable.count} background app
          {closeable.count === 1 ? '' : 's'} running that you probably don't need
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {closeable.names.map((n) => (
            <span key={n} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-300 ring-1 ring-white/10">
              {n}
            </span>
          ))}
        </div>
      </div>
      <Button variant="warn" onClick={onCloseAll} disabled={busy}>
        Close all suggested
      </Button>
    </div>
  );
}
