import { useState } from 'react';
import { Button, CategoryBadge, Spinner } from './ui';
import { fmtBytes } from '../api';
import type { ProcessGroup } from '../types';

export function ProcessTable({
  groups,
  maxMem,
  busyName,
  onStopGroup,
  onStopPid,
}: {
  groups: ProcessGroup[];
  maxMem: number;
  busyName: string | null;
  onStopGroup: (g: ProcessGroup) => void;
  onStopPid: (pid: number, name: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (groups.length === 0) {
    return <div className="py-14 text-center text-sm text-slate-400">No processes match your filter.</div>;
  }

  return (
    <div className="scroll-area max-h-[calc(100vh-360px)] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-900/80 backdrop-blur text-[11px] uppercase tracking-wide text-slate-400">
            <th className="w-9 px-3 py-3" />
            <th className="px-3 py-3 text-left font-semibold">Process</th>
            <th className="hidden px-3 py-3 text-left font-semibold sm:table-cell">Type</th>
            <th className="px-3 py-3 text-right font-semibold">Copies</th>
            <th className="px-3 py-3 text-right font-semibold">RAM</th>
            <th className="w-24 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isOpen = expanded.has(g.name);
            const busy = busyName === g.name;
            return (
              <ProcessRow
                key={g.name}
                g={g}
                maxMem={maxMem}
                isOpen={isOpen}
                busy={busy}
                onToggle={() => toggle(g.name)}
                onStopGroup={() => onStopGroup(g)}
                onStopPid={onStopPid}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProcessRow({
  g,
  maxMem,
  isOpen,
  busy,
  onToggle,
  onStopGroup,
  onStopPid,
}: {
  g: ProcessGroup;
  maxMem: number;
  isOpen: boolean;
  busy: boolean;
  onToggle: () => void;
  onStopGroup: () => void;
  onStopPid: (pid: number, name: string) => void;
}) {
  const pctBar = maxMem > 0 ? (g.totalMemBytes / maxMem) * 100 : 0;
  return (
    <>
      <tr className="border-b border-white/5 transition hover:bg-white/[0.03]">
        <td className="px-3 py-2.5 align-middle">
          <button
            onClick={onToggle}
            className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
          </button>
        </td>
        <td className="px-3 py-2.5 align-middle">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{g.name}</span>
            {g.safeToClose && (
              <span className="text-[11px] font-bold text-amber-400">· can close</span>
            )}
          </div>
        </td>
        <td className="hidden px-3 py-2.5 align-middle sm:table-cell">
          <CategoryBadge category={g.category} />
        </td>
        <td className="px-3 py-2.5 text-right align-middle tabular-nums text-slate-300">{g.instances.length}</td>
        <td className="px-3 py-2.5 text-right align-middle">
          <div className="font-bold tabular-nums text-slate-100">{fmtBytes(g.totalMemBytes)}</div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-400" style={{ width: `${pctBar}%` }} />
          </div>
        </td>
        <td className="px-3 py-2.5 text-right align-middle">
          {g.protected ? (
            <span className="text-[11px] text-slate-500">locked</span>
          ) : (
            <Button variant="danger" size="sm" onClick={onStopGroup} disabled={busy}>
              {busy ? <Spinner /> : null}
              Stop
            </Button>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-black/20">
          <td />
          <td colSpan={5} className="px-3 pb-3 pt-1">
            {g.advice && <div className="py-1.5 text-xs text-slate-400">{g.advice}</div>}
            <div className="mt-1 divide-y divide-white/5">
              {g.instances
                .slice()
                .sort((a, b) => b.memBytes - a.memBytes)
                .map((inst) => (
                  <div key={inst.pid} className="flex items-center justify-between py-1.5 text-xs text-slate-400">
                    <span className="tabular-nums">
                      PID {inst.pid} · {fmtBytes(inst.memBytes)}
                    </span>
                    {inst.protected ? (
                      <span className="text-slate-600">locked</span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onStopPid(inst.pid, g.name)}>
                        Stop this PID
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
