# ◈ MoniTerror

A local **RAM & port monitor** for your dev machine. It shows what's eating your
memory, **tells you which background apps you probably don't need running**, lets
you stop them with one click, and shows **which process owns each port** so you can
free the one your dev server is fighting over.

Cross-platform: **Windows, macOS, and Linux**. Everything runs locally on your own
machine — nothing is sent anywhere. Runs as a **native desktop app** (Electron) or
as a local web app — your choice.

![tech](https://img.shields.io/badge/React-18-61dafb) ![tech](https://img.shields.io/badge/Tailwind-4-38bdf8) ![tech](https://img.shields.io/badge/TypeScript-5-3178c6) ![tech](https://img.shields.io/badge/Express-4-000) ![tech](https://img.shields.io/badge/Electron-33-47848f)

**[⬇ Download for Windows](https://github.com/Waleed-Zaheer/MoniTerror/releases/latest)** — one portable `.exe`, no install. Or [run from source](#option-b--run-from-source-any-os) on any OS.

---

## What it does

**RAM & Processes tab**
- A live gauge of total memory in use sits up top, so you see the headline number before the detail.
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

**Live**
- Both tabs auto-refresh every 5 seconds — pause it with the auto toggle, or refresh manually.
- Stopping a process or freeing a port removes the row instantly (optimistically), then a background refresh reconciles with the real system state.

**Safety**
- Critical OS processes (Windows `svchost`/`lsass`/…, macOS `launchd`/`WindowServer`/…, Linux `systemd`/`Xorg`/…) are marked **locked** and cannot be stopped — enforced **server-side**, not just hidden in the UI.

---

## Requirements

- **Node.js 18+**
- **pnpm** (`npm install -g pnpm`)
- On **Linux**, the Ports tab uses `ss` (from `iproute2`, preinstalled on most distros).
  On **macOS** it uses the built-in `lsof`. On **Windows** it uses `netstat` — nothing to install.

## Get it

### Option A — Windows portable app (no install, no terminal)

**[Download the latest `MoniTerror <version>.exe` from Releases](https://github.com/Waleed-Zaheer/MoniTerror/releases/latest)** —
a single portable file. Copy it anywhere (Desktop, a USB drive, wherever) and
double-click it. It opens as a native window — no browser tab, no server to start
by hand. Every release is built automatically from this repo's source by
[a GitHub Action](./.github/workflows/release.yml).

Prefer to build it yourself? It's one command:

```bash
pnpm install
pnpm dist:win
```

This produces the same **`release/MoniTerror <version>.exe`**.

> First run: Windows SmartScreen may warn about an "unrecognized app" because the
> exe isn't code-signed (that costs money). Click **More info → Run anyway**. Nothing
> leaves your machine — you can read every line of the source right here.

### Option B — run from source (any OS)

```bash
git clone https://github.com/Waleed-Zaheer/MoniTerror.git
cd MoniTerror
pnpm install
pnpm start
```

`pnpm start` builds the server + client and launches on `http://localhost:4590`.
Open that in your browser.

> Want a different port? `MONITERROR_PORT=5000 pnpm start`

### Build the desktop app yourself

```bash
pnpm electron        # run it as a desktop window, no packaging
pnpm dist:win         # package a portable Windows .exe into release/
```

`pnpm dist:win` embeds the same Express server used in web mode — it picks a free
port automatically (starting at 4590) and opens a native window pointed at it, via
[`electron/main.ts`](electron/main.ts). macOS/Linux packaging targets aren't wired
up yet (`pnpm start` works everywhere in the meantime); `electron-builder` supports
them if you want to add `mac`/`linux` targets to the `build` block in `package.json`.

## Develop

Two terminals for hot-reload:

```bash
pnpm dev:server   # tsc --watch, then run `pnpm server` to (re)start the API on :4590
pnpm dev:client   # Vite dev server on :5173 with /api proxied to :4590
```

Then open `http://localhost:5173`.

Lint with [oxlint](https://oxc.rs): `pnpm lint`.

---

## Architecture

One Express server does the real work; two different shells present it. That's the whole
design, and it's why the desktop app and the browser version are never out of sync.

```text
              ┌──────────────────────────────────────────┐
              │  React 18 + Tailwind v4  (client/)        │
              │  polls /api/* every 5s                    │
              └───────────────┬──────────────────────────┘
                              │ HTTP :4590
              ┌───────────────▼──────────────────────────┐
              │  Express + TypeScript  (src/)             │
              │   ├─ lib/system.ts   per-OS probing       │
              │   └─ lib/catalog.ts  "safe to close" KB   │
              └───────────────┬──────────────────────────┘
                              │ shells out to native OS tools
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Windows              macOS                  Linux
   tasklist/netstat     ps/lsof                ps/ss

  Served by either:
    • Electron (electron/main.ts) — embeds the same Express server
    • A browser at localhost — same server, run standalone
```

### No native addons, no elevated privileges

Process and port data comes from shelling out to tools that ship with each OS
(`netstat` on Windows, `lsof` on macOS, `ss` on Linux) rather than from a native Node addon.

That's a deliberate trade: parsing command output is less elegant than a C++ binding, but it
means no node-gyp, no build toolchain, no per-Node-version rebuilds, and no admin rights —
which is exactly why the Windows build can ship as a single portable `.exe` with nothing to
install.

### Safety is enforced server-side

Critical OS processes (`svchost`/`lsass` on Windows, `launchd`/`WindowServer` on macOS,
`systemd`/`Xorg` on Linux) are marked **locked** and the stop/free routes reject them with
`403`.

The important detail is that this lives in the API, not the UI. Hiding a button would be
cosmetic — anyone could still `curl` the endpoint. Since the whole product is "a thing that
kills processes on your machine", the guard belongs at the only layer that can actually
enforce it.

### Optimistic UI, then reconciliation

Stopping a process removes its row immediately, then the next 5-second poll reconciles
against real system state. If the kill silently failed, the row comes back — which is the
honest outcome, and better than a spinner that blocks the UI on an operation that usually
succeeds instantly.

## How it works

| Part | Stack |
|------|-------|
| Backend | Express + TypeScript (`src/`), compiled with `tsc` to `dist/` |
| Frontend | React 18 + Tailwind CSS v4, built by Vite (`client/`) to `client/dist/` |
| Desktop shell | Electron (`electron/`), compiled with `tsc` to `dist-electron/`; embeds the same Express server |
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
