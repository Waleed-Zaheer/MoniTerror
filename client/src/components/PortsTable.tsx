import { Button, CategoryDot, Spinner } from './ui';
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
    return <div className="py-14 text-center text-[13px] text-slate-500">No matching ports in use.</div>;
  }

  return (
    <div className="scroll-area max-h-[calc(100vh-340px)] overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2.5 text-right font-medium">Port</th>
            <th className="px-3 py-2.5 text-left font-medium">Proto</th>
            <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">State</th>
            <th className="hidden px-3 py-2.5 text-left font-medium md:table-cell">Address</th>
            <th className="px-3 py-2.5 text-left font-medium">Process</th>
            <th className="px-3 py-2.5 text-right font-medium">PID</th>
            <th className="w-28 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => {
            const busy = busyPort === p.localPort;
            return (
              <tr key={`${p.proto}-${p.localPort}-${p.pid}`} className="border-b border-line transition-colors hover:bg-white/2.5">
                <td className="px-3 py-2 text-right align-middle">
                  <div className="flex items-center justify-end gap-1.5">
                    {p.isCommonDevPort && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Common dev port" />}
                    <span className="font-semibold tabular-nums text-slate-100">{p.localPort}</span>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle font-mono text-xs text-slate-500">{p.proto}</td>
                <td className="hidden px-3 py-2 align-middle sm:table-cell">
                  {p.state && <span className="text-xs text-emerald-400/90">{p.state}</span>}
                </td>
                <td className="hidden px-3 py-2 align-middle font-mono text-xs text-slate-500 md:table-cell">{p.localAddress}</td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100">{p.processName}</span>
                    <CategoryDot category={p.category} showLabel={false} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right align-middle font-mono text-xs text-slate-500">{p.pid || '—'}</td>
                <td className="px-3 py-2 text-right align-middle">
                  {p.protected ? (
                    <span className="text-xs text-slate-600">locked</span>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => onFree(p.localPort, p.processName)} disabled={busy}>
                      {busy ? <Spinner /> : null}
                      Free
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
