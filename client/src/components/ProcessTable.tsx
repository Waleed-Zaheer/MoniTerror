import { useState } from 'react';
import { Button, CategoryDot, Spinner, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { IconChevronRight } from './icons';
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
    return <div className="py-14 text-center text-[13px] text-muted-foreground">No processes match your filter.</div>;
  }

  return (
    <div className="scroll-area max-h-[calc(100vh-360px)] overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-9 px-3 py-2.5" />
            <th className="px-3 py-2.5 text-left font-medium">Process</th>
            <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">Type</th>
            <th className="px-3 py-2.5 text-right font-medium">Copies</th>
            <th className="px-3 py-2.5 text-right font-medium">RAM</th>
            <th className="w-24 px-3 py-2.5" />
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
      <tr className="border-b border-border transition-colors hover:bg-accent/40">
        <td className="px-3 py-2 align-middle">
          <button
            onClick={onToggle}
            className="grid h-5.5 w-5.5 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <IconChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </button>
        </td>
        <td className="px-3 py-2 align-middle">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{g.name}</span>
            {g.safeToClose && (
              <Tooltip>
                <TooltipTrigger render={<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" tabIndex={0} />} />
                <TooltipContent>Safe to close</TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
        <td className="hidden px-3 py-2 align-middle sm:table-cell">
          <CategoryDot category={g.category} />
        </td>
        <td className="px-3 py-2 text-right align-middle text-muted-foreground">{g.instances.length}</td>
        <td className="px-3 py-2 text-right align-middle">
          <div className="font-semibold text-foreground">{fmtBytes(g.totalMemBytes)}</div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/30" style={{ width: `${pctBar}%` }} />
          </div>
        </td>
        <td className="px-3 py-2 text-right align-middle">
          {g.protected ? (
            <Tooltip>
              <TooltipTrigger render={<span className="text-xs text-muted-foreground/70" tabIndex={0}>locked</span>} />
              <TooltipContent>System/protected process — can&apos;t be stopped</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="danger" size="sm" onClick={onStopGroup} disabled={busy}>
              {busy ? <Spinner /> : null}
              Stop
            </Button>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-background/40">
          <td />
          <td colSpan={5} className="px-3 pb-3 pt-1">
            {g.advice && <div className="py-1.5 text-xs text-muted-foreground">{g.advice}</div>}
            <div className="mt-1 divide-y divide-border">
              {g.instances
                .slice()
                .sort((a, b) => b.memBytes - a.memBytes)
                .map((inst) => (
                  <div key={inst.pid} className="flex items-center justify-between py-1.5 text-xs text-muted-foreground">
                    <span>
                      PID {inst.pid} · {fmtBytes(inst.memBytes)}
                    </span>
                    {inst.protected ? (
                      <span className="text-muted-foreground/70">locked</span>
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
