import { Card } from './ui';
import { fmtBytes } from '../api';
import type { Overview } from '../types';

function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded-md bg-white/8 ${className}`} />;
}

const SIZE = 108;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function gaugeColor(pct: number): string {
  if (pct >= 90) return '#fb7185';
  if (pct >= 80) return '#f0b429';
  return '#3fc98a';
}

function RadialGauge({ percent }: { percent: number }) {
  const offset = CIRCUMFERENCE - (Math.min(percent, 100) / 100) * CIRCUMFERENCE;
  const color = gaugeColor(percent);
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s ease, stroke .6s ease' }}
      />
    </svg>
  );
}

export function MemoryHero({ overview }: { overview: Overview | null }) {
  const pct = overview?.usedPercent ?? 0;

  return (
    <Card className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <RadialGauge percent={pct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {overview ? (
              <span className="text-2xl font-bold tracking-tight text-slate-50">{pct}%</span>
            ) : (
              <Skeleton className="h-6 w-12" />
            )}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-200">Memory in use</div>
          <div className="mt-1 text-[13px] text-slate-500">
            {overview ? `${fmtBytes(overview.usedMemBytes)} of ${fmtBytes(overview.totalMemBytes)}` : <Skeleton className="h-4 w-32" />}
          </div>
        </div>
      </div>

      <div className="hidden h-14 w-px bg-line sm:block" />
      <div className="h-px w-full bg-line sm:hidden" />

      <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-3">
        <Figure label="Total RAM" value={overview ? fmtBytes(overview.totalMemBytes) : null} />
        <Figure label="Free" value={overview ? fmtBytes(overview.freeMemBytes) : null} />
        <Figure
          label="Reclaimable"
          value={overview ? fmtBytes(overview.closeable.totalMemBytes) : null}
          hint={overview ? `${overview.closeable.count} background app${overview.closeable.count === 1 ? '' : 's'}` : undefined}
          tone="emerald"
        />
      </div>
    </Card>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string | null; hint?: string; tone?: 'emerald' }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {value ? (
        <div className={`mt-1 text-xl font-bold tracking-tight ${tone === 'emerald' ? 'text-emerald-400' : 'text-slate-100'}`}>
          {value}
        </div>
      ) : (
        <Skeleton className="mt-1.5 h-6 w-16" />
      )}
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
