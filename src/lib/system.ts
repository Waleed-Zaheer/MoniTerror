import { execFile } from 'child_process';
import os from 'os';
import path from 'path';
import { classify, Category, Classification } from './catalog';

export interface ProcessInstance {
  pid: number;
  memBytes: number;
  protected: boolean;
}

export interface ProcessGroup {
  name: string;
  totalMemBytes: number;
  protected: boolean;
  category: Category;
  safeToClose: boolean;
  advice: string | null;
  instances: ProcessInstance[];
}

export interface MemInfo {
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  usedPercent: number;
}

export interface CloseableSummary {
  count: number;
  totalMemBytes: number;
  names: string[];
}

export interface Overview extends MemInfo {
  platform: string;
  platformLabel: string;
  processes: ProcessGroup[];
  closeable: CloseableSummary;
}

export interface PortEntry {
  proto: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  state: string;
  pid: number;
  processName: string;
  protected: boolean;
  category: Category;
  isCommonDevPort: boolean;
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

interface RawProc {
  pid: number;
  name: string;
  memBytes: number;
}

const PLATFORM = process.platform; // 'win32' | 'darwin' | 'linux' | ...
const PLATFORM_LABEL =
  PLATFORM === 'win32' ? 'Windows' :
  PLATFORM === 'darwin' ? 'macOS' :
  PLATFORM === 'linux' ? 'Linux' : PLATFORM;

const COMMON_DEV_PORTS = new Set([
  3000, 3001, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8443, 9000, 9229, 4321, 1420, 4590,
]);

const PROTECTED_WINDOWS = new Set([
  'system idle process', 'system', 'registry', 'smss', 'csrss', 'wininit',
  'winlogon', 'services', 'lsass', 'svchost', 'dwm', 'explorer',
  'fontdrvhost', 'sihost', 'runtimebroker', 'searchindexer', 'spoolsv',
  'audiodg', 'memory compression', 'conhost', 'wudfhost', 'dashost',
  'ctfmon', 'taskhostw', 'lsaiso', 'securityhealthservice',
]);

const PROTECTED_POSIX = new Set([
  'launchd', 'kernel_task', 'kernel', 'systemd', 'init', 'windowserver',
  'loginwindow', 'launchservicesd', 'coreaudiod', 'mds', 'mds_stores',
  'syslogd', 'dbus-daemon', 'dbus', 'systemd-journald', 'systemd-logind',
  'systemd-resolved', 'systemd-udevd', 'xorg', 'wayland', 'gnome-shell',
  'kwin', 'kwin_x11', 'kwin_wayland', 'plasmashell', 'pipewire',
  'pulseaudio', 'networkmanager', 'sshd', 'cron', 'crond', 'logind',
  'polkitd', 'udevd', 'getty', 'agetty', 'wireplumber',
]);

function isProtected(pid: number, name: string | undefined): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  if (PLATFORM === 'win32') {
    if (Number(pid) <= 4) return true;
    return PROTECTED_WINDOWS.has(n);
  }
  // POSIX: pid 0 (kernel) and 1 (init/launchd) are always protected.
  if (Number(pid) <= 1) return true;
  return PROTECTED_POSIX.has(n);
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

/** execFile that resolves with stdout even on non-zero exit (some tools like ss/lsof exit non-zero with partial output). */
function runLenient(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32, windowsHide: true }, (_err, stdout) => {
      resolve(stdout || '');
    });
  });
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Process listing (per-platform)
// ---------------------------------------------------------------------------

const WIN_PROCESS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$procs = Get-Process | Select-Object Id, ProcessName, @{N='Mem';E={$_.WorkingSet64}}
@($procs) | ConvertTo-Json -Compress -Depth 3
`;

async function listProcessesWindows(): Promise<RawProc[]> {
  const stdout = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_PROCESS_SCRIPT]);
  const data = JSON.parse(stdout) as { Id: number; ProcessName: string; Mem: number } | Array<{ Id: number; ProcessName: string; Mem: number }>;
  return toArray(data).map((p) => ({ pid: Number(p.Id), name: p.ProcessName || 'Unknown', memBytes: Number(p.Mem) || 0 }));
}

async function listProcessesPosix(): Promise<RawProc[]> {
  // rss is in KB. comm may be a full path (macOS) or truncated name (Linux).
  const args = PLATFORM === 'darwin'
    ? ['-axo', 'pid=,rss=,comm=']
    : ['-eo', 'pid=,rss=,comm='];
  const stdout = await run('ps', args);
  const procs: RawProc[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const memBytes = Number(m[2]) * 1024;
    const name = path.basename(m[3].trim());
    procs.push({ pid, name, memBytes });
  }
  return procs;
}

function listProcesses(): Promise<RawProc[]> {
  return PLATFORM === 'win32' ? listProcessesWindows() : listProcessesPosix();
}

async function getPidNameMap(): Promise<Map<number, string>> {
  const procs = await listProcesses();
  const map = new Map<number, string>();
  for (const p of procs) map.set(p.pid, p.name);
  return map;
}

function getMemory(): MemInfo {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalMemBytes: total,
    freeMemBytes: free,
    usedMemBytes: used,
    usedPercent: Math.round((used / total) * 1000) / 10,
  };
}

export async function getOverview(): Promise<Overview> {
  const [procs, mem] = await Promise.all([listProcesses(), Promise.resolve(getMemory())]);

  const groups = new Map<string, ProcessGroup>();
  for (const p of procs) {
    const prot = isProtected(p.pid, p.name);
    let g = groups.get(p.name);
    if (!g) {
      const cls: Classification = classify(p.name, prot);
      g = {
        name: p.name,
        totalMemBytes: 0,
        protected: prot,
        category: cls.category,
        safeToClose: cls.safeToClose,
        advice: cls.advice,
        instances: [],
      };
      groups.set(p.name, g);
    }
    g.totalMemBytes += p.memBytes;
    g.instances.push({ pid: p.pid, memBytes: p.memBytes, protected: prot });
  }

  const processes = Array.from(groups.values()).sort((a, b) => b.totalMemBytes - a.totalMemBytes);

  const closeableGroups = processes.filter((g) => g.safeToClose && !g.protected);
  const closeable: CloseableSummary = {
    count: closeableGroups.length,
    totalMemBytes: closeableGroups.reduce((sum, g) => sum + g.totalMemBytes, 0),
    names: closeableGroups.map((g) => g.name),
  };

  return {
    ...mem,
    platform: PLATFORM,
    platformLabel: PLATFORM_LABEL,
    processes,
    closeable,
  };
}

// ---------------------------------------------------------------------------
// Ports (per-platform) — listening TCP + bound UDP only
// ---------------------------------------------------------------------------

function portFromAddress(addr: string): number {
  // Handles "0.0.0.0:8080", "[::]:8080", "127.0.0.1:8080", "*:8080"
  const idx = addr.lastIndexOf(':');
  if (idx === -1) return NaN;
  return Number(addr.slice(idx + 1));
}

async function getPortsWindows(nameMap: Map<number, string>): Promise<PortEntry[]> {
  const out = await run('netstat.exe', ['-ano']);
  const entries: PortEntry[] = [];
  const re = /^\s*(TCP|UDP)\s+(\S+)\s+(\S+)\s+(?:(\S+)\s+)?(\d+)\s*$/i;
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const proto = m[1].toUpperCase() as 'TCP' | 'UDP';
    const localAddr = m[2];
    const state = m[4] || '';
    const pid = Number(m[5]);
    // Keep only listening TCP and bound UDP.
    if (proto === 'TCP' && state.toUpperCase() !== 'LISTENING') continue;
    const localPort = portFromAddress(localAddr);
    if (!Number.isFinite(localPort)) continue;
    entries.push(buildPortEntry(proto, localAddr, localPort, proto === 'TCP' ? 'LISTENING' : '', pid, nameMap));
  }
  return entries;
}

async function getPortsDarwin(nameMap: Map<number, string>): Promise<PortEntry[]> {
  const [tcp, udp] = await Promise.all([
    runLenient('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']),
    runLenient('lsof', ['-nP', '-iUDP']),
  ]);
  const entries: PortEntry[] = [];
  const parse = (out: string, proto: 'TCP' | 'UDP') => {
    for (const line of out.split(/\r?\n/)) {
      if (!line || line.startsWith('COMMAND')) continue;
      const cols = line.trim().split(/\s+/);
      if (cols.length < 9) continue;
      const pid = Number(cols[1]);
      const name = cols[0];
      const nameField = cols.slice(8).join(' '); // e.g. "*:3000 (LISTEN)" or "127.0.0.1:5432"
      const addrToken = nameField.split(/\s+/)[0].split('->')[0];
      const localPort = portFromAddress(addrToken);
      if (!Number.isFinite(localPort)) continue;
      if (!nameMap.has(pid)) nameMap.set(pid, name);
      entries.push(buildPortEntry(proto, addrToken, localPort, proto === 'TCP' ? 'LISTENING' : '', pid, nameMap));
    }
  };
  parse(tcp, 'TCP');
  parse(udp, 'UDP');
  return entries;
}

async function getPortsLinux(nameMap: Map<number, string>): Promise<PortEntry[]> {
  const out = await runLenient('ss', ['-tulpnH']);
  const entries: PortEntry[] = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.trim().split(/\s+/);
    // Netid State Recv-Q Send-Q Local Peer [Process]
    if (cols.length < 5) continue;
    const proto = cols[0].toUpperCase().startsWith('U') ? 'UDP' : 'TCP';
    const localAddr = cols[4];
    const localPort = portFromAddress(localAddr);
    if (!Number.isFinite(localPort)) continue;
    const procField = cols.slice(6).join(' ');
    const pidMatch = procField.match(/pid=(\d+)/);
    const nameMatch = procField.match(/users:\(\("([^"]+)"/);
    const pid = pidMatch ? Number(pidMatch[1]) : 0;
    if (pid && nameMatch && !nameMap.has(pid)) nameMap.set(pid, nameMatch[1]);
    entries.push(buildPortEntry(proto as 'TCP' | 'UDP', localAddr, localPort, proto === 'TCP' ? 'LISTENING' : '', pid, nameMap));
  }
  return entries;
}

function buildPortEntry(proto: 'TCP' | 'UDP', localAddress: string, localPort: number, state: string, pid: number, nameMap: Map<number, string>): PortEntry {
  const name = nameMap.get(pid) || (pid === 0 ? 'System' : 'Unknown');
  const prot = isProtected(pid, name);
  return {
    proto,
    localAddress,
    localPort,
    state,
    pid,
    processName: name,
    protected: prot,
    category: classify(name, prot).category,
    isCommonDevPort: COMMON_DEV_PORTS.has(localPort),
  };
}

export async function getPorts(): Promise<PortEntry[]> {
  const nameMap = await getPidNameMap();
  let entries: PortEntry[];
  if (PLATFORM === 'win32') entries = await getPortsWindows(nameMap);
  else if (PLATFORM === 'darwin') entries = await getPortsDarwin(nameMap);
  else entries = await getPortsLinux(nameMap);

  // Dedupe rows that differ only by IPv4/IPv6 binding or multiple fds.
  const seen = new Set<string>();
  const deduped: PortEntry[] = [];
  for (const e of entries) {
    const key = `${e.proto}:${e.localPort}:${e.pid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }

  deduped.sort((a, b) => a.localPort - b.localPort || a.proto.localeCompare(b.proto));
  return deduped;
}

// ---------------------------------------------------------------------------
// Stopping processes / freeing ports
// ---------------------------------------------------------------------------

function killProcess(pid: number): Promise<string> {
  if (PLATFORM === 'win32') return run('taskkill.exe', ['/F', '/PID', String(pid)]);
  return run('kill', ['-9', String(pid)]);
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

  await killProcess(pid);
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
      await killProcess(pid);
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

  const blocked = targets.find((t) => t.protected);
  if (blocked) {
    throw new AppError(`Refusing to free port ${port}: held by protected/system process "${blocked.processName}" (PID ${blocked.pid})`, 403);
  }

  const uniquePids = Array.from(new Set(targets.map((t) => t.pid))).filter((pid) => pid > 0);
  const results: KillResult[] = [];
  for (const pid of uniquePids) {
    try {
      await killProcess(pid);
      results.push({ pid, ok: true });
    } catch (e) {
      results.push({ pid, ok: false, error: (e as Error).message });
    }
  }
  return results;
}
