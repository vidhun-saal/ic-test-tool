import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { startServer, type ServerHandle } from './server';
import { extractZip, cleanupBaseDir } from './server/content';
import { store } from './server/store';
import {
  IPC,
  type AppState,
  type LaunchConfig,
  type UploadResult,
} from './shared/types';

const isDev = !!process.env['ELECTRON_RENDERER_URL'];
const TEMP_BASE = path.join(os.tmpdir(), 'lms-tester');

let mainWindow: BrowserWindow | null = null;
let serverHandle: ServerHandle | null = null;

async function ensureBaseDir(): Promise<string> {
  const dir = path.join(TEMP_BASE, `session-${Date.now()}-${uuidv4().slice(0, 8)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function defaultLaunchConfig(activityId: string): LaunchConfig {
  if (!serverHandle) throw new Error('Server not started');
  const endpoint = `${serverHandle.info.baseUrl}/xapi/`;
  const credential = Buffer.from(`tester:${uuidv4()}`).toString('base64');
  return {
    endpoint,
    auth: `Basic ${credential}`,
    actor: {
      name: 'Test Learner',
      mbox: 'mailto:test@example.com',
      objectType: 'Agent',
    },
    activityId,
    registration: uuidv4(),
  };
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f1115',
    title: 'xAPI LMS Tester',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle(IPC.GET_SERVER_INFO, () => serverHandle?.info ?? null);

  ipcMain.handle(IPC.GET_STATE, (): AppState => {
    if (!serverHandle) {
      throw new Error('Server not started');
    }
    return {
      serverInfo: serverHandle.info,
      package: store.getPackage(),
      statements: store.getStatements(),
      httpLog: store.getHttpLog(),
    };
  });

  ipcMain.handle(IPC.CLEAR_LOG, () => {
    store.clearLog();
    return { ok: true };
  });

  ipcMain.handle(IPC.PICK_ZIP, async (): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select an xAPI / Storyline zip package',
      properties: ['openFile'],
      filters: [{ name: 'Zip archives', extensions: ['zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC.UPLOAD_ZIP,
    async (_e, filePath: string): Promise<UploadResult> => {
      if (!serverHandle) {
        return { ok: false, error: 'Server not started yet.' };
      }
      try {
        const originalName = path.basename(filePath);
        const pkg = await extractZip(filePath, serverHandle.baseDir, originalName);
        store.setPackage(pkg);
        const activityId = `http://localhost/activities/${pkg.id}`;
        return { ok: true, package: pkg, defaultLaunch: defaultLaunchConfig(activityId) };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}

function wireStoreToRenderer(): void {
  store.on('statement', (s) => {
    mainWindow?.webContents.send(IPC.STATEMENT_EVENT, s);
  });
  store.on('http', (h) => {
    mainWindow?.webContents.send(IPC.HTTP_EVENT, h);
  });
}

async function shutdown(): Promise<void> {
  if (serverHandle) {
    try {
      await serverHandle.stop();
    } catch {
      /* ignore */
    }
    await cleanupBaseDir(serverHandle.baseDir);
    serverHandle = null;
  }
}

app.whenReady().then(async () => {
  const baseDir = await ensureBaseDir();
  serverHandle = await startServer(baseDir);
  registerIpc();
  wireStoreToRenderer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await shutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (serverHandle) {
    event.preventDefault();
    await shutdown();
    app.exit(0);
  }
});
