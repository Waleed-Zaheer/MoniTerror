import express, { Express } from 'express';
import path from 'path';
import { Server } from 'http';
import { getOverview, getPorts, killPid, killByName, freePort, AppError } from './lib/system';

const DEFAULT_PORT = Number(process.env.MONITERROR_PORT) || 4590;
const CLIENT_DIR = path.join(__dirname, '..', 'client', 'dist');

function errorStatus(e: unknown): number {
  return e instanceof AppError ? e.status : 500;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

/**
 * Rejects cross-origin requests to the mutating endpoints. Without this, any
 * web page open in the user's browser — not just this app — can POST to
 * http://localhost:<port>/api/processes/... and kill processes on the
 * user's machine; that works purely because the request originates from
 * the user's own machine, regardless of whether this server is reachable
 * from the network (see the host binding below).
 *
 * Same-origin requests (this app's own served page, or the Electron
 * renderer) either omit Origin or send one matching our own — both allowed.
 * Any other Origin is rejected.
 */
function requireSameOrigin(port: number) {
  const allowed = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) {
      res.status(403).json({ error: 'Cross-origin request rejected' });
      return;
    }
    next();
  };
}

export function createApp(port: number = DEFAULT_PORT): Express {
  const app = express();
  app.use(express.static(CLIENT_DIR));
  app.use(express.json());
  app.use('/api/processes', requireSameOrigin(port));
  app.use('/api/ports', requireSameOrigin(port));

  app.get('/api/overview', async (_req, res) => {
    try {
      res.json(await getOverview());
    } catch (e) {
      res.status(errorStatus(e)).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/ports', async (_req, res) => {
    try {
      res.json(await getPorts());
    } catch (e) {
      res.status(errorStatus(e)).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/processes/pid/:pid/stop', async (req, res) => {
    try {
      res.json(await killPid(req.params.pid));
    } catch (e) {
      res.status(errorStatus(e)).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/processes/name/:name/stop', async (req, res) => {
    try {
      res.json(await killByName(req.params.name));
    } catch (e) {
      res.status(errorStatus(e)).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/ports/:port/free', async (req, res) => {
    try {
      res.json(await freePort(req.params.port));
    } catch (e) {
      res.status(errorStatus(e)).json({ error: errorMessage(e) });
    }
  });

  // SPA fallback: serve index.html for any non-API GET route.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  });

  return app;
}

const LOCALHOST = '127.0.0.1';

export function startServer(port: number = DEFAULT_PORT): Promise<Server> {
  return new Promise((resolve, reject) => {
    const app = createApp(port);
    // Explicit host: an unspecified host defaults to 0.0.0.0 (all network
    // interfaces), which would let anyone on the same Wi-Fi/LAN reach the
    // process-kill endpoints below. This app has no reason to be reachable
    // from anywhere but this machine.
    const server = app.listen(port, LOCALHOST, () => {
      console.log(`moniterror running at http://${LOCALHOST}:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// `node dist/server.js` (web/CLI mode) still starts the server immediately.
// The Electron main process instead imports startServer() and picks its own port.
if (require.main === module) {
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
