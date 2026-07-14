interface ProcessInstance {
  pid: number;
  memBytes: number;
  protected: boolean;
}

interface ProcessGroup {
  name: string;
  totalMemBytes: number;
  protected: boolean;
  instances: ProcessInstance[];
}

interface Overview {
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  usedPercent: number;
  processes: ProcessGroup[];
}

interface PortEntry {
  proto: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  foreignAddress: string;
  state: string;
  pid: number;
  processName: string;
  protected: boolean;
}

const AUTO_REFRESH_MS = 5000;

const memBarFill = document.getElementById('memBarFill') as HTMLDivElement;
const memText = document.getElementById('memText') as HTMLDivElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const autoRefreshToggle = document.getElementById('autoRefreshToggle') as HTMLInputElement;
const ramTableBody = document.getElementById('ramTableBody') as HTMLTableSectionElement;
const portsTableBody = document.getElementById('portsTableBody') as HTMLTableSectionElement;
const ramUpdatedAt = document.getElementById('ramUpdatedAt') as HTMLSpanElement;
const portsUpdatedAt = document.getElementById('portsUpdatedAt') as HTMLSpanElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
const expandedGroups = new Set<string>();

function fmtBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function showToast(message: string, isError = false): void {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  window.setTimeout(() => toastEl.classList.remove('show'), 3500);
}

async function apiPost(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error || `Request failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function renderMem(overview: Overview): void {
  const pct = overview.usedPercent;
  memBarFill.style.width = `${Math.min(pct, 100)}%`;
  memBarFill.classList.toggle('warn', pct >= 80 && pct < 90);
  memBarFill.classList.toggle('danger', pct >= 90);
  memText.textContent =
    `${fmtBytes(overview.usedMemBytes)} used of ${fmtBytes(overview.totalMemBytes)} ` +
    `(${pct}%) — ${fmtBytes(overview.freeMemBytes)} free`;
}

function renderRamTable(overview: Overview): void {
  ramTableBody.innerHTML = '';

  if (overview.processes.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = '<td colspan="5">No processes found.</td>';
    ramTableBody.appendChild(tr);
    return;
  }

  for (const group of overview.processes) {
    const groupRow = document.createElement('tr');
    groupRow.className = 'group-row';

    const expandCell = document.createElement('td');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn';
    expandBtn.textContent = expandedGroups.has(group.name) ? '▾' : '▸';
    expandBtn.addEventListener('click', () => {
      if (expandedGroups.has(group.name)) expandedGroups.delete(group.name);
      else expandedGroups.add(group.name);
      renderRamTable(overview);
    });
    expandCell.appendChild(expandBtn);
    groupRow.appendChild(expandCell);

    const nameCell = document.createElement('td');
    nameCell.className = 'proc-name';
    nameCell.textContent = group.name;
    if (group.protected) {
      const tag = document.createElement('span');
      tag.className = 'tag protected';
      tag.textContent = 'protected';
      tag.style.marginLeft = '8px';
      nameCell.appendChild(tag);
    }
    groupRow.appendChild(nameCell);

    const countCell = document.createElement('td');
    countCell.textContent = String(group.instances.length);
    groupRow.appendChild(countCell);

    const memCell = document.createElement('td');
    memCell.className = 'mono';
    memCell.textContent = fmtBytes(group.totalMemBytes);
    groupRow.appendChild(memCell);

    const actionCell = document.createElement('td');
    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn btn-danger btn-sm';
    stopBtn.textContent = 'Stop';
    stopBtn.disabled = group.protected;
    stopBtn.title = group.protected ? 'Protected system process' : `Stop all ${group.instances.length} instance(s)`;
    stopBtn.addEventListener('click', async () => {
      const confirmMsg = group.instances.length > 1
        ? `Stop all ${group.instances.length} instances of "${group.name}"? This will forcibly kill them.`
        : `Stop "${group.name}" (PID ${group.instances[0].pid})? This will forcibly kill it.`;
      if (!window.confirm(confirmMsg)) return;
      stopBtn.disabled = true;
      const result = await apiPost(`/api/processes/name/${encodeURIComponent(group.name)}/stop`);
      if (result.ok) {
        showToast(`Stopped "${group.name}".`);
        loadOverview();
      } else {
        showToast(result.error || 'Failed to stop process', true);
        stopBtn.disabled = false;
      }
    });
    actionCell.appendChild(stopBtn);
    groupRow.appendChild(actionCell);

    ramTableBody.appendChild(groupRow);

    if (expandedGroups.has(group.name)) {
      const detailRow = document.createElement('tr');
      detailRow.className = 'instances-row';
      const detailCell = document.createElement('td');
      detailCell.colSpan = 5;

      for (const inst of group.instances) {
        const line = document.createElement('div');
        line.className = 'instance-line';

        const label = document.createElement('span');
        label.textContent = `PID ${inst.pid} — ${fmtBytes(inst.memBytes)}`;
        line.appendChild(label);

        const killBtn = document.createElement('button');
        killBtn.className = 'btn btn-sm';
        killBtn.textContent = 'Stop this PID';
        killBtn.disabled = inst.protected;
        killBtn.addEventListener('click', async () => {
          if (!window.confirm(`Stop PID ${inst.pid} (${group.name})?`)) return;
          killBtn.disabled = true;
          const result = await apiPost(`/api/processes/pid/${inst.pid}/stop`);
          if (result.ok) {
            showToast(`Stopped PID ${inst.pid}.`);
            loadOverview();
          } else {
            showToast(result.error || 'Failed to stop process', true);
            killBtn.disabled = false;
          }
        });
        line.appendChild(killBtn);
        detailCell.appendChild(line);
      }

      detailRow.appendChild(detailCell);
      ramTableBody.appendChild(detailRow);
    }
  }
}

function renderPortsTable(ports: PortEntry[]): void {
  portsTableBody.innerHTML = '';

  if (ports.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = '<td colspan="7">No open ports found.</td>';
    portsTableBody.appendChild(tr);
    return;
  }

  for (const entry of ports) {
    const tr = document.createElement('tr');

    const portCell = document.createElement('td');
    portCell.className = 'mono';
    portCell.textContent = String(entry.localPort);
    tr.appendChild(portCell);

    const protoCell = document.createElement('td');
    protoCell.textContent = entry.proto;
    tr.appendChild(protoCell);

    const stateCell = document.createElement('td');
    if (entry.state) {
      const tag = document.createElement('span');
      tag.className = 'tag' + (entry.state === 'LISTENING' ? ' listening' : '');
      tag.textContent = entry.state;
      stateCell.appendChild(tag);
    }
    tr.appendChild(stateCell);

    const addrCell = document.createElement('td');
    addrCell.className = 'mono';
    addrCell.textContent = entry.localAddress;
    tr.appendChild(addrCell);

    const nameCell = document.createElement('td');
    nameCell.textContent = entry.processName;
    if (entry.protected) {
      const tag = document.createElement('span');
      tag.className = 'tag protected';
      tag.textContent = 'protected';
      tag.style.marginLeft = '8px';
      nameCell.appendChild(tag);
    }
    tr.appendChild(nameCell);

    const pidCell = document.createElement('td');
    pidCell.className = 'mono';
    pidCell.textContent = String(entry.pid);
    tr.appendChild(pidCell);

    const actionCell = document.createElement('td');
    const freeBtn = document.createElement('button');
    freeBtn.className = 'btn btn-danger btn-sm';
    freeBtn.textContent = 'Free port';
    freeBtn.disabled = entry.protected;
    freeBtn.addEventListener('click', async () => {
      if (!window.confirm(`Free port ${entry.localPort} by stopping "${entry.processName}" (PID ${entry.pid})?`)) return;
      freeBtn.disabled = true;
      const result = await apiPost(`/api/ports/${entry.localPort}/free`);
      if (result.ok) {
        showToast(`Freed port ${entry.localPort}.`);
        loadPorts();
        loadOverview();
      } else {
        showToast(result.error || 'Failed to free port', true);
        freeBtn.disabled = false;
      }
    });
    actionCell.appendChild(freeBtn);
    tr.appendChild(actionCell);

    portsTableBody.appendChild(tr);
  }
}

function timeNow(): string {
  return new Date().toLocaleTimeString();
}

async function loadOverview(): Promise<void> {
  try {
    const res = await fetch('/api/overview');
    const data: Overview = await res.json();
    renderMem(data);
    renderRamTable(data);
    ramUpdatedAt.textContent = `Updated ${timeNow()}`;
  } catch (e) {
    ramUpdatedAt.textContent = 'Failed to load';
    showToast(`Failed to load process data: ${(e as Error).message}`, true);
  }
}

async function loadPorts(): Promise<void> {
  try {
    const res = await fetch('/api/ports');
    const data: PortEntry[] = await res.json();
    renderPortsTable(data);
    portsUpdatedAt.textContent = `Updated ${timeNow()}`;
  } catch (e) {
    portsUpdatedAt.textContent = 'Failed to load';
    showToast(`Failed to load port data: ${(e as Error).message}`, true);
  }
}

function refreshAll(): void {
  loadOverview();
  loadPorts();
}

function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`${tab.dataset.tab}-tab`);
      target?.classList.add('active');
    });
  });
}

function setupAutoRefresh(): void {
  const start = () => {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(refreshAll, AUTO_REFRESH_MS);
  };
  const stop = () => {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  };

  autoRefreshToggle.addEventListener('change', () => {
    if (autoRefreshToggle.checked) start();
    else stop();
  });

  if (autoRefreshToggle.checked) start();
}

refreshBtn.addEventListener('click', refreshAll);
setupTabs();
setupAutoRefresh();
refreshAll();
