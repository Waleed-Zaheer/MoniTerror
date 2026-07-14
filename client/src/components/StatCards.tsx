import { Card } from './ui';
import { fmtBytes } from '../api';
import type { Overview } from '../types';

function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded-md bg-white/10 ${className}`} />;
}

export function StatCards({ overview }: { overview: Overview | null }) {
  const pct = overview?.usedPercent ?? 0;
  const barColor =
    pct >= 90 ? 'from-rose-500 to-rose-300' :
    pct >= 80 ? 'from-amber-500 to-amber-300' :
    'from-emerald-500 to-emerald-300';

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.4fr]">
      <Card className="p-4 sm:col-span-2 lg:col-span-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Memory in use</span>
          {overview ? (
            <span className="text-2xl font-extrabold tracking-tight text-slate-50">{pct}%</span>
          ) : (
            <Skeleton className="h-7 w-14" />
          )}
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full bg-linear-to-r ${barColor} transition-[width] duration-500`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 text-xs text-slate-400">
          {overview
            ? `${fmtBytes(overview.usedMemBytes)} used of ${fmtBytes(overview.totalMemBytes)} · ${fmtBytes(overview.freeMemBytes)} free`
            : <Skeleton className="h-3.5 w-48" />}
        </div>
      </Card>

      <StatFigure label="Total RAM" value={overview ? fmtBytes(overview.totalMemBytes) : null} />
      <StatFigure label="Free" value={overview ? fmtBytes(overview.freeMemBytes) : null} />

      <Card className="p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reclaimable now</span>
        {overview ? (
          <>
            <span className="mt-1 block text-2xl font-extrabold tracking-tight text-emerald-400">
              {fmtBytes(overview.closeable.totalMemBytes)}
            </span>
            <span className="text-[11px] text-slate-500">
              {overview.closeable.count} background app(s) you likely don't need
            </span>
          </>
        ) : (
          <Skeleton className="mt-1.5 h-7 w-20" />
        )}
      </Card>
    </div>
  );
}

function StatFigure({ label, value }: { label: string; value: string | null }) {
  return (
    <Card className="p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {value ? (
        <span className="mt-1 block text-2xl font-extrabold tracking-tight text-slate-50">{value}</span>
      ) : (
        <Skeleton className="mt-1.5 h-7 w-20" />
      )}
    </Card>
  );
}
