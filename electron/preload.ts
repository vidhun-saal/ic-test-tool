import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AppState,
  type Ctp,
  type HttpLogEntry,
  type KeycloakStatus,
  type ServerInfo,
  type TeachingPointRow,
  type TpEntry,
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

  onTpInventory: (cb: (entries: TpEntry[]) => void): (() => void) => {
    const handler = (_e: unknown, entries: TpEntry[]) => cb(entries);
    ipcRenderer.on(IPC.TP_INVENTORY_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC.TP_INVENTORY_EVENT, handler);
  },

  kcLogin: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.KC_LOGIN),

  kcLogout: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.KC_LOGOUT),

  kcStatus: (): Promise<KeycloakStatus> => ipcRenderer.invoke(IPC.KC_STATUS),

  listCtps: (): Promise<Ctp[]> => ipcRenderer.invoke(IPC.LIST_CTPS),

  listTeachingPoints: (ctpId: string): Promise<TeachingPointRow[]> =>
    ipcRenderer.invoke(IPC.LIST_TEACHING_POINTS, ctpId),

  onKcStatus: (cb: (status: KeycloakStatus) => void): (() => void) => {
    const handler = (_e: unknown, status: KeycloakStatus) => cb(status);
    ipcRenderer.on(IPC.KC_STATUS_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC.KC_STATUS_EVENT, handler);
  },
};

contextBridge.exposeInMainWorld('lms', api);

export type LmsApi = typeof api;
