import { Badge, Button, CategoryBadge, Spinner } from './ui';
import type { PortEntry } from '../types';

export function PortsTable({
  ports,
  busyPort,
  onFree,
}: {
  ports: PortEntry[];
  busyPort: number | null;
  onFree: (port: number, name: string) => void;
}) {
  if (ports.length === 0) {
    return <div className="py-14 text-center text-sm text-slate-400">No matching ports in use.</div>;
  }

  return (
    <div className="scroll-area max-h-[calc(100vh-340px)] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-900/80 backdrop-blur text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-3 text-right font-semibold">Port</th>
            <th className="px-3 py-3 text-left font-semibold">Proto</th>
            <th className="hidden px-3 py-3 text-left font-semibold sm:table-cell">State</th>
            <th className="hidden px-3 py-3 text-left font-semibold md:table-cell">Address</th>
            <th className="px-3 py-3 text-left font-semibold">Process</th>
            <th className="px-3 py-3 text-right font-semibold">PID</th>
            <th className="w-28 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => {
            const busy = busyPort === p.localPort;
            return (
              <tr key={`${p.proto}-${p.localPort}-${p.pid}`} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 text-right align-middle">
                  <span className="font-bold tabular-nums text-slate-100">{p.localPort}</span>
                  {p.isCommonDevPort && (
                    <div className="mt-0.5">
                      <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">dev</Badge>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle font-mono text-xs text-slate-300">{p.proto}</td>
                <td className="hidden px-3 py-2.5 align-middle sm:table-cell">
                  {p.state && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
                      {p.state}
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 align-middle font-mono text-xs text-slate-400 md:table-cell">{p.localAddress}</td>
                <td className="px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100">{p.processName}</span>
                    <CategoryBadge category={p.category} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right align-middle font-mono text-xs text-slate-400">{p.pid || '—'}</td>
                <td className="px-3 py-2.5 text-right align-middle">
                  {p.protected ? (
                    <span className="text-[11px] text-slate-500">locked</span>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => onFree(p.localPort, p.processName)} disabled={busy}>
                      {busy ? <Spinner /> : null}
                      Free port
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
