import type { KillResult, Overview, PortEntry } from './types';

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

/**
 * The name/port endpoints can target several PIDs at once and report one
 * `{pid, ok, error}` per target rather than failing the whole HTTP request —
 * a single stuck/protected process shouldn't hide that the others succeeded.
 * Still throws on a total failure (HTTP error, or every target failed) so
 * existing catch-based callers keep working; callers that want to show a
 * partial-failure message should inspect the returned array themselves.
 */
async function postResults(url: string): Promise<KillResult[]> {
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  const results = data as KillResult[];
  if (results.length > 0 && results.every((r) => !r.ok)) {
    throw new Error(results[0]?.error || 'Failed to stop the process(es).');
  }
  return results;
}

export const api = {
  overview: () => getJson<Overview>('/api/overview'),
  ports: () => getJson<PortEntry[]>('/api/ports'),
  stopByName: (name: string) => postResults(`/api/processes/name/${encodeURIComponent(name)}/stop`),
  stopByPid: (pid: number) => post(`/api/processes/pid/${pid}/stop`),
  freePort: (port: number) => postResults(`/api/ports/${port}/free`),
};

export function fmtBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}
