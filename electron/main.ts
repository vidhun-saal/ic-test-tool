import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import os from 'os';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { startServer, type ServerHandle } from './server';
import { extractZip, cleanupBaseDir } from './server/content';
import { scanPackage } from './server/scanner';
import { store } from './server/store';
import {
  IPC,
  type AppState,
  type LaunchConfig,
  type TpEntry,
  type UploadResult,
  type Ctp,
  type TeachingPointRow,
  type KeycloakStatus,
} from './shared/types';
import { loadApiConfigFromEnv, setApiConfig } from './server/config';
import { loginInteractive, KeycloakLoginCancelled } from './server/keycloakAuth';
import {
  setTokens,
  clearTokens,
  getKeycloakStatus,
  setTokenStatusNotifier,
} from './server/tokenStore';
import { listCtps, listTeachingPoints } from './server/e2Api';

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
      tpInventory: store.getTpInventory(),
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
        const pkgRoot = path.join(serverHandle.baseDir, pkg.id);
        const hits = await scanPackage(pkgRoot);
        for (const h of hits) {
          store.upsertTpEntry({ raw: h.raw, source: 'static', file: h.file });
        }
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

  ipcMain.handle(IPC.KC_LOGIN, async (): Promise<{ ok: boolean; error?: string }> => {
    if (!mainWindow) {
      return { ok: false, error: 'Main window unavailable' };
    }
    try {
      console.log('[KC] login starting…');
      const tokens = await loginInteractive(mainWindow);
      setTokens(tokens);
      console.log('[KC] login OK, token expires in', tokens.expiresInSeconds, 's');
      return { ok: true };
    } catch (e) {
      if (e instanceof KeycloakLoginCancelled) {
        console.log('[KC] login cancelled by user');
        return { ok: false, error: 'cancelled' };
      }
      console.error('[KC] login error:', e instanceof Error ? e.message : e);
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle(IPC.KC_LOGOUT, () => {
    clearTokens();
    return { ok: true };
  });

  ipcMain.handle(IPC.KC_STATUS, (): KeycloakStatus => getKeycloakStatus());

  ipcMain.handle(IPC.LIST_CTPS, async (): Promise<Ctp[]> => {
    return await listCtps();
  });

  ipcMain.handle(
    IPC.LIST_TEACHING_POINTS,
    async (_e, ctpId: string): Promise<TeachingPointRow[]> => {
      return await listTeachingPoints(ctpId);
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
  store.on('tp', (entries: TpEntry[]) => {
    mainWindow?.webContents.send(IPC.TP_INVENTORY_EVENT, entries);
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

function broadcastKcStatus(): void {
  const s = getKeycloakStatus();
  mainWindow?.webContents.send(IPC.KC_STATUS_EVENT, s);
}

app.whenReady().then(async () => {
  try {
    setApiConfig(loadApiConfigFromEnv(process.env));
    setTokenStatusNotifier(broadcastKcStatus);
  } catch (e) {
    console.warn('API config:', e instanceof Error ? e.message : String(e));
  }

  const baseDir = await ensureBaseDir();
  serverHandle = await startServer(baseDir);
  registerIpc();
  wireStoreToRenderer();
  await createWindow();
  broadcastKcStatus();

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
