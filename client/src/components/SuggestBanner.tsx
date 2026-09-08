import { Button } from './ui';
import { IconZap } from './icons';
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
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border border-l-2 border-l-warning bg-card py-3 pl-3.5 pr-4 sm:flex-row sm:items-center">
      <IconZap className="h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] text-foreground/90">
          <span className="font-semibold text-foreground">~{fmtBytes(closeable.totalMemBytes)}</span> reclaimable —{' '}
          {closeable.count} background app{closeable.count === 1 ? '' : 's'} you likely don't need right now
        </span>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {closeable.names.map((n, i) => (
            <span key={n}>
              {n}
              {i < closeable.names.length - 1 && <span className="text-muted-foreground/50">,</span>}
            </span>
          ))}
        </div>
      </div>
      <Button variant="warn" size="sm" onClick={onCloseAll} disabled={busy} className="shrink-0">
        Close all
      </Button>
    </div>
  );
}
