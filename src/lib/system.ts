import { execFile } from 'child_process';

export interface ProcessInstance {
  pid: number;
  memBytes: number;
  protected: boolean;
}

export interface ProcessGroup {
  name: string;
  totalMemBytes: number;
  protected: boolean;
  instances: ProcessInstance[];
}

export interface Overview {
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  usedPercent: number;
  processes: ProcessGroup[];
}

export interface PortEntry {
  proto: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  foreignAddress: string;
  state: string;
  pid: number;
  processName: string;
  protected: boolean;
}

export interface KillResult {
  pid: number;
  ok: boolean;
  error?: string;
}

export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const PROTECTED_NAMES = new Set([
  'system idle process', 'system', 'registry', 'smss', 'csrss', 'wininit',
  'winlogon', 'services', 'lsass', 'svchost', 'dwm', 'explorer',
  'fontdrvhost', 'sihost', 'runtimebroker', 'searchindexer', 'spoolsv',
  'audiodg', 'memory compression', 'conhost', 'wudfhost', 'dashost',
]);

function isProtected(pid: number, name: string | undefined): boolean {
  if (Number(pid) <= 4) return true;
  return PROTECTED_NAMES.has(String(name ?? '').trim().toLowerCase());
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

interface RawProc {
  Id: number;
  ProcessName: string;
  Mem: number;
}

const PROCESS_LIST_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$procs = Get-Process | Select-Object Id, ProcessName, @{N='Mem';E={$_.WorkingSet64}}
@($procs) | ConvertTo-Json -Compress -Depth 3
`;

const OVERVIEW_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$procs = Get-Process | Select-Object Id, ProcessName, @{N='Mem';E={$_.WorkingSet64}}
$result = [PSCustomObject]@{
  TotalMem = $cs.TotalPhysicalMemory
  FreeMem = ($os.FreePhysicalMemory * 1024)
  Processes = @($procs)
}
$result | ConvertTo-Json -Compress -Depth 4
`;

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function getOverview(): Promise<Overview> {
  const stdout = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', OVERVIEW_SCRIPT]);
  const data = JSON.parse(stdout) as { TotalMem: number; FreeMem: number; Processes: RawProc | RawProc[] };
  const rawProcs = toArray(data.Processes);

  const groups = new Map<string, ProcessGroup>();
  for (const p of rawProcs) {
    const name = p.ProcessName || 'Unknown';
    const mem = Number(p.Mem) || 0;
    if (!groups.has(name)) {
      groups.set(name, { name, totalMemBytes: 0, protected: isProtected(p.Id, name), instances: [] });
    }
    const g = groups.get(name)!;
    g.totalMemBytes += mem;
    g.instances.push({ pid: p.Id, memBytes: mem, protected: isProtected(p.Id, name) });
  }

  const processes = Array.from(groups.values()).sort((a, b) => b.totalMemBytes - a.totalMemBytes);

  return {
    totalMemBytes: data.TotalMem,
    freeMemBytes: data.FreeMem,
    usedMemBytes: data.TotalMem - data.FreeMem,
    usedPercent: Math.round(((data.TotalMem - data.FreeMem) / data.TotalMem) * 1000) / 10,
    processes,
  };
}

async function getPidNameMap(): Promise<Map<number, string>> {
  const stdout = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PROCESS_LIST_SCRIPT]);
  const data = JSON.parse(stdout) as RawProc | RawProc[];
  const rawProcs = toArray(data);
  const map = new Map<number, string>();
  for (const p of rawProcs) map.set(Number(p.Id), p.ProcessName || 'Unknown');
  return map;
}

const NETSTAT_LINE_RE = /^\s*(TCP|UDP)\s+(\S+)\s+(\S+)\s+(?:(\S+)\s+)?(\d+)\s*$/i;

export async function getPorts(): Promise<PortEntry[]> {
  const [netstatOut, nameMap] = await Promise.all([
    run('netstat.exe', ['-ano']),
    getPidNameMap(),
  ]);

  const lines = netstatOut.split(/\r?\n/);
  const entries: PortEntry[] = [];

  for (const line of lines) {
    const m = line.match(NETSTAT_LINE_RE);
    if (!m) continue;
    const [, proto, localAddr, foreignAddr, state, pidStr] = m;
    const pid = Number(pidStr);
    const localPort = Number(localAddr.split(':').pop());
    if (!Number.isFinite(localPort)) continue;
    const name = nameMap.get(pid) || 'Unknown';
    entries.push({
      proto: proto.toUpperCase() as 'TCP' | 'UDP',
      localAddress: localAddr,
      localPort,
      foreignAddress: foreignAddr,
      state: proto.toUpperCase() === 'UDP' ? '' : (state || ''),
      pid,
      processName: name,
      protected: isProtected(pid, name),
    });
  }

  entries.sort((a, b) => a.localPort - b.localPort);
  return entries;
}

export async function killPid(pidInput: string | number): Promise<{ pid: number; name: string }> {
  const pid = Number(pidInput);
  if (!Number.isFinite(pid)) throw new AppError('Invalid PID', 400);

  const nameMap = await getPidNameMap();
  const name = nameMap.get(pid);
  if (name === undefined) throw new AppError('Process not found', 404);
  if (isProtected(pid, name)) {
    throw new AppError(`Refusing to stop protected/system process "${name}" (PID ${pid})`, 403);
  }

  await run('taskkill.exe', ['/F', '/PID', String(pid)]);
  return { pid, name };
}

export async function killByName(name: string): Promise<KillResult[]> {
  const nameMap = await getPidNameMap();
  const target = name.trim().toLowerCase();
  const pids = Array.from(nameMap.entries())
    .filter(([, n]) => n.toLowerCase() === target)
    .map(([pid]) => pid);

  if (pids.length === 0) throw new AppError('No matching processes found', 404);
  if (isProtected(pids[0], name)) {
    throw new AppError(`Refusing to stop protected/system process "${name}"`, 403);
  }

  const results: KillResult[] = [];
  for (const pid of pids) {
    try {
      await run('taskkill.exe', ['/F', '/PID', String(pid)]);
      results.push({ pid, ok: true });
    } catch (e) {
      results.push({ pid, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

export async function freePort(portInput: string | number): Promise<KillResult[]> {
  const port = Number(portInput);
  const ports = await getPorts();
  const targets = ports.filter((e) => e.localPort === port);
  if (targets.length === 0) throw new AppError('Nothing is listening on that port', 404);

  const uniquePids = Array.from(new Set(targets.map((t) => t.pid)));
  const blocked = targets.find((t) => t.protected);
  if (blocked) {
    throw new AppError(`Refusing to free port ${port}: held by protected/system process "${blocked.processName}" (PID ${blocked.pid})`, 403);
  }

  const results: KillResult[] = [];
  for (const pid of uniquePids) {
    try {
      await run('taskkill.exe', ['/F', '/PID', String(pid)]);
      results.push({ pid, ok: true });
    } catch (e) {
      results.push({ pid, ok: false, error: (e as Error).message });
    }
  }
  return results;
}
