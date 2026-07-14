# ◈ MoniTerror

A local **RAM & port monitor** for your dev machine. It shows what's eating your
memory, **tells you which background apps you probably don't need running**, lets
you stop them with one click, and shows **which process owns each port** so you can
free the one your dev server is fighting over.

Cross-platform: **Windows, macOS, and Linux**. Everything runs locally on your own
machine — nothing is sent anywhere.

![tech](https://img.shields.io/badge/React-18-61dafb) ![tech](https://img.shields.io/badge/Tailwind-4-38bdf8) ![tech](https://img.shields.io/badge/TypeScript-5-3178c6) ![tech](https://img.shields.io/badge/Express-4-000)

---

## What it does

**RAM & Processes tab**
- Every app grouped by name, sorted by memory, biggest first.
- Each process is classified — **Background app**, **Dev**, **Browser**, **Editor**, **System**, **Other**.
- Apps you likely don't need in the background (Spotify, Discord, OneDrive, local LLMs, idle databases, …) are flagged **“can close”**, with a banner showing roughly how much RAM you'd reclaim and a **Close all suggested** button.
- Expand any row to see individual PIDs and stop them one at a time.
- Filter by name or by category.

**Ports tab**
- Every port that's actively **listening or bound**, mapped to the process holding it — the ones that cause *“port already in use.”*
- Common dev ports (3000, 5173, 8080, …) are tagged **dev**.
- One-click **Free port** stops whatever is holding it.
- Filter by port, process, or address.

**Safety**
- Critical OS processes (Windows `svchost`/`lsass`/…, macOS `launchd`/`WindowServer`/…, Linux `systemd`/`Xorg`/…) are marked **locked** and cannot be stopped — enforced **server-side**, not just hidden in the UI.

---

## Requirements

- **Node.js 18+**
- **pnpm** (`npm install -g pnpm`)
- On **Linux**, the Ports tab uses `ss` (from `iproute2`, preinstalled on most distros).
  On **macOS** it uses the built-in `lsof`. On **Windows** it uses `netstat` — nothing to install.

## Run it

```bash
git clone https://github.com/Waleed-Zaheer/MoniTerror.git
cd MoniTerror
pnpm install
pnpm start
```

`pnpm start` builds the server + client and launches on **http://localhost:4590**.
Open that in your browser.

> Want a different port? `MONITERROR_PORT=5000 pnpm start`

## Develop

Two terminals for hot-reload:

```bash
pnpm dev:server   # tsc --watch, then run `pnpm server` to (re)start the API on :4590
pnpm dev:client   # Vite dev server on :5173 with /api proxied to :4590
```

Then open **http://localhost:5173**.

Lint with [oxlint](https://oxc.rs): `pnpm lint`.

---

## How it works

| Part | Stack |
|------|-------|
| Backend | Express + TypeScript (`src/`), compiled with `tsc` to `dist/` |
| Frontend | React 18 + Tailwind CSS v4, built by Vite (`client/`) to `client/dist/` |
| Data source | Native OS tools per platform — no native addons, no elevated privileges needed |

Per-platform probing lives in [`src/lib/system.ts`](src/lib/system.ts); the
“what's safe to close” knowledge base is in [`src/lib/catalog.ts`](src/lib/catalog.ts).

### API

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/overview` | Memory summary + processes grouped by name + closeable summary |
| `GET`  | `/api/ports` | Listening/bound ports mapped to processes |
| `POST` | `/api/processes/name/:name/stop` | Stop all instances of a process |
| `POST` | `/api/processes/pid/:pid/stop` | Stop one PID |
| `POST` | `/api/ports/:port/free` | Stop whatever holds a port |

Stop/free routes refuse protected system processes with `403`.

---

## Notes

- Stopping a process **force-kills** it — save your work first. MoniTerror asks for confirmation before every stop.
- The classification catalog is heuristic; unknown apps are left un-flagged rather than guessed at. PRs to extend [`catalog.ts`](src/lib/catalog.ts) welcome.
