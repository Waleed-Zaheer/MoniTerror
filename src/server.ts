import express from 'express';
import path from 'path';
import { getOverview, getPorts, killPid, killByName, freePort, AppError } from './lib/system';

const app = express();
const PORT = Number(process.env.MONITERROR_PORT) || 4590;

const CLIENT_DIR = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIR));
app.use(express.json());

function errorStatus(e: unknown): number {
  return e instanceof AppError ? e.status : 500;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

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

app.listen(PORT, () => {
  console.log(`moniterror running at http://localhost:${PORT}`);
});
