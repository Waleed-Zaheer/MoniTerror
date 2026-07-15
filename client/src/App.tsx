import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { Category, Overview, PortEntry, ProcessGroup } from './types';
import { Button, Card, CATEGORY_LABELS, ConfirmProvider, Spinner, Toggle, ToastProvider, useConfirm, useToast } from './components/ui';
import { IconCpu, IconPlug, IconSearch } from './components/icons';
import { MemoryHero } from './components/MemoryHero';
import { SuggestBanner } from './components/SuggestBanner';
import { ProcessTable } from './components/ProcessTable';
import { PortsTable } from './components/PortsTable';

const AUTO_REFRESH_MS = 5000;
const FILTERS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'background-app', label: CATEGORY_LABELS['background-app'] },
  { key: 'dev', label: CATEGORY_LABELS.dev },
  { key: 'browser', label: CATEGORY_LABELS.browser },
  { key: 'editor', label: CATEGORY_LABELS.editor },
  { key: 'system', label: CATEGORY_LABELS.system },
];

function AppInner() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'ram' | 'ports'>('ram');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  const [ramSearch, setRamSearch] = useState('');
  const [ramFilter, setRamFilter] = useState<Category | 'all'>('all');
  const [portSearch, setPortSearch] = useState('');

  const [busyName, setBusyName] = useState<string | null>(null);
  const [busyPort, setBusyPort] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [ov, pr] = await Promise.all([api.overview(), api.ports()]);
      setOverview(ov);
      setPorts(pr);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (auto) {
      timerRef.current = setInterval(() => refresh(false), AUTO_REFRESH_MS);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [auto, refresh]);

  // Optimistic local edits — applied immediately on a successful stop/free so the
  // row disappears right away, instead of waiting on a second slow round-trip.
  // A background refresh() still runs to reconcile with the real system state.
  const removeGroupLocally = useCallback((name: string) => {
    setOverview((prev) => {
      if (!prev) return prev;
      const removed = prev.processes.find((g) => g.name === name);
      const processes = prev.processes.filter((g) => g.name !== name);
      const wasCloseable = removed && prev.closeable.names.includes(name);
      const closeable = wasCloseable
        ? {
            count: prev.closeable.count - 1,
            totalMemBytes: prev.closeable.totalMemBytes - (removed?.totalMemBytes ?? 0),
            names: prev.closeable.names.filter((n) => n !== name),
          }
        : prev.closeable;
      return { ...prev, processes, closeable };
    });
  }, []);

  const removeInstanceLocally = useCallback((pid: number) => {
    setOverview((prev) => {
      if (!prev) return prev;
      const processes = prev.processes
        .map((g) => {
          const inst = g.instances.find((i) => i.pid === pid);
          if (!inst) return g;
          return {
            ...g,
            instances: g.instances.filter((i) => i.pid !== pid),
            totalMemBytes: g.totalMemBytes - inst.memBytes,
          };
        })
        .filter((g) => g.instances.length > 0);
      return { ...prev, processes };
    });
  }, []);

  const removePortLocally = useCallback((port: number) => {
    setPorts((prev) => prev.filter((p) => p.localPort !== port));
  }, []);

  const stopGroup = useCallback(async (g: ProcessGroup) => {
    const multi = g.instances.length > 1;
    const ok = await confirm({
      title: multi ? `Stop all ${g.instances.length} instances of "${g.name}"?` : `Stop "${g.name}"?`,
      description: multi
        ? 'This will forcibly kill every running instance of this process.'
        : `This will forcibly kill PID ${g.instances[0].pid}. Unsaved work in it will be lost.`,
      confirmLabel: 'Stop',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyName(g.name);
    try {
      await api.stopByName(g.name);
      toast(`Stopped "${g.name}".`);
      removeGroupLocally(g.name);
      refresh(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyName(null);
    }
  }, [confirm, refresh, removeGroupLocally, toast]);

  const stopPid = useCallback(async (pid: number, name: string) => {
    const ok = await confirm({
      title: `Stop PID ${pid}?`,
      description: `Process: "${name}". This forcibly kills it and any unsaved work in it will be lost.`,
      confirmLabel: 'Stop',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.stopByPid(pid);
      toast(`Stopped PID ${pid}.`);
      removeInstanceLocally(pid);
      refresh(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }, [confirm, refresh, removeInstanceLocally, toast]);

  const freePort = useCallback(async (port: number, name: string) => {
    const ok = await confirm({
      title: `Free port ${port}?`,
      description: `This stops "${name}" — the process currently holding it.`,
      confirmLabel: 'Free port',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyPort(port);
    try {
      await api.freePort(port);
      toast(`Freed port ${port}.`);
      removePortLocally(port);
      refresh(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyPort(null);
    }
  }, [confirm, refresh, removePortLocally, toast]);

  const closeAll = useCallback(async () => {
    if (!overview) return;
    const names = overview.closeable.names;
    if (names.length === 0) return;
    const ok = await confirm({
      title: `Close ${names.length} background app${names.length === 1 ? '' : 's'}?`,
      description: `${names.join(', ')} — this forcibly stops all of them.`,
      confirmLabel: 'Close all',
      variant: 'warn',
    });
    if (!ok) return;
    setBulkBusy(true);
    let ok2 = 0;
    for (const name of names) {
      try {
        await api.stopByName(name);
        removeGroupLocally(name);
        ok2++;
      } catch { /* keep going */ }
    }
    toast(`Closed ${ok2} of ${names.length} app(s).`);
    setBulkBusy(false);
    refresh(false);
  }, [confirm, overview, refresh, removeGroupLocally, toast]);

  const filteredGroups = useMemo(() => {
    if (!overview) return [];
    const q = ramSearch.trim().toLowerCase();
    return overview.processes.filter((g) => {
      if (ramFilter !== 'all' && g.category !== ramFilter) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [overview, ramSearch, ramFilter]);

  const maxMem = useMemo(
    () => (overview ? Math.max(...overview.processes.map((g) => g.totalMemBytes), 1) : 1),
    [overview],
  );

  const filteredPorts = useMemo(() => {
    const q = portSearch.trim().toLowerCase();
    if (!q) return ports;
    return ports.filter((p) =>
      String(p.localPort).includes(q) ||
      p.processName.toLowerCase().includes(q) ||
      p.localAddress.toLowerCase().includes(q),
    );
  }, [ports, portSearch]);

  return (
    <div className="app-bg min-h-screen text-slate-300">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-lg text-brand-400">◈</span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-slate-100">MoniTerror</div>
              <div className="text-xs text-slate-500">{overview ? overview.platformLabel : '—'} · :4590</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Toggle checked={auto} onChange={setAuto} label="Auto-refresh" />
            <Button variant="primary" onClick={() => refresh(true)} disabled={loading}>
              {loading ? <Spinner /> : null}
              Refresh
            </Button>
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-5 sm:px-6">
        <MemoryHero overview={overview} />

        {/* Segmented tabs */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
            <SegmentButton active={tab === 'ram'} onClick={() => setTab('ram')} icon={<IconCpu className="h-3.5 w-3.5" />} label="RAM & Processes" />
            <SegmentButton active={tab === 'ports'} onClick={() => setTab('ports')} icon={<IconPlug className="h-3.5 w-3.5" />} label="Ports" count={ports.length} />
          </div>
          <span className="hidden text-xs text-slate-600 sm:block">{updatedAt && `Updated ${updatedAt}`}</span>
        </div>

        {/* RAM tab */}
        {tab === 'ram' && (
          <div className="animate-fade-up pt-4">
            {overview && <SuggestBanner overview={overview} onCloseAll={closeAll} busy={bulkBusy} />}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                <input
                  type="search"
                  value={ramSearch}
                  onChange={(e) => setRamSearch(e.target.value)}
                  placeholder="Filter processes by name…"
                  className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-brand-500"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRamFilter(f.key)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
                      ${ramFilter === f.key ? 'bg-white/10 text-slate-100' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden">
              <ProcessTable
                groups={filteredGroups}
                maxMem={maxMem}
                busyName={busyName}
                onStopGroup={stopGroup}
                onStopPid={stopPid}
              />
            </Card>
          </div>
        )}

        {/* Ports tab */}
        {tab === 'ports' && (
          <div className="animate-fade-up pt-4">
            <div className="relative mb-3">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                type="search"
                value={portSearch}
                onChange={(e) => setPortSearch(e.target.value)}
                placeholder="Filter by port, process, or address…"
                className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-brand-500"
              />
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Ports actively listening or bound — the ones that make a dev server say "port already in use."
              <span className="ml-1.5 inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> common dev port</span>
            </p>
            <Card className="overflow-hidden">
              <PortsTable ports={filteredPorts} busyPort={busyPort} onFree={freePort} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors
        ${active ? 'bg-white/10 text-slate-50' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`rounded px-1.5 text-[11px] font-semibold ${active ? 'bg-white/10 text-slate-300' : 'bg-white/5 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppInner />
      </ConfirmProvider>
    </ToastProvider>
  );
}
