import { app, BrowserWindow, Menu } from 'electron';
import type { Server } from 'http';
import net from 'net';
import path from 'path';

// Loaded from the compiled server bundle (dist/server.js), built alongside this file.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startServer } = require(path.join(__dirname, '..', 'dist', 'server.js')) as {
  startServer: (port?: number) => Promise<Server>;
};

const PREFERRED_PORT = 4590;

let mainWindow: BrowserWindow | null = null;
let httpServer: Server | null = null;

function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const tester = net.createServer();
      tester.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port < startPort + 50) {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, '127.0.0.1');
    };
    tryPort(startPort);
  });
}

function createWindow(url: string) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#060810',
    title: 'MoniTerror',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  Menu.setApplicationMenu(null);
  const port = await findFreePort(PREFERRED_PORT);
  httpServer = await startServer(port);
  createWindow(`http://localhost:${port}`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && httpServer) {
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : PREFERRED_PORT;
      createWindow(`http://localhost:${port}`);
    }
  });

  app.on('before-quit', () => {
    httpServer?.close();
  });
}
