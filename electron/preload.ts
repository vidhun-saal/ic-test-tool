import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AppState,
  type HttpLogEntry,
  type ServerInfo,
  type UploadResult,
  type XapiStatement,
} from './shared/types';

const api = {
  getServerInfo: (): Promise<ServerInfo | null> =>
    ipcRenderer.invoke(IPC.GET_SERVER_INFO),

  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC.GET_STATE),

  clearLog: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.CLEAR_LOG),

  pickZip: (): Promise<string | null> => ipcRenderer.invoke(IPC.PICK_ZIP),

  uploadZip: (filePath: string): Promise<UploadResult> =>
    ipcRenderer.invoke(IPC.UPLOAD_ZIP, filePath),

  onStatement: (cb: (s: XapiStatement) => void): (() => void) => {
    const handler = (_e: unknown, s: XapiStatement) => cb(s);
    ipcRenderer.on(IPC.STATEMENT_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC.STATEMENT_EVENT, handler);
  },

  onHttp: (cb: (h: HttpLogEntry) => void): (() => void) => {
    const handler = (_e: unknown, h: HttpLogEntry) => cb(h);
    ipcRenderer.on(IPC.HTTP_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC.HTTP_EVENT, handler);
  },
};

contextBridge.exposeInMainWorld('lms', api);

export type LmsApi = typeof api;
