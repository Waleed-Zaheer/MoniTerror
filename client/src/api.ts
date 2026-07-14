import type { Overview, PortEntry } from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function post(url: string): Promise<void> {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
}

export const api = {
  overview: () => getJson<Overview>('/api/overview'),
  ports: () => getJson<PortEntry[]>('/api/ports'),
  stopByName: (name: string) => post(`/api/processes/name/${encodeURIComponent(name)}/stop`),
  stopByPid: (pid: number) => post(`/api/processes/pid/${pid}/stop`),
  freePort: (port: number) => post(`/api/ports/${port}/free`),
};

export function fmtBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}
