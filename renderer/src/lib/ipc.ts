import type {
  AppState,
  Ctp,
  HttpLogEntry,
  KeycloakStatus,
  ServerInfo,
  TeachingPointRow,
  TpEntry,
  UploadResult,
  XapiStatement,
} from '../../../electron/shared/types';

export interface LmsApi {
  getServerInfo(): Promise<ServerInfo | null>;
  getState(): Promise<AppState>;
  clearLog(): Promise<{ ok: true }>;
  pickZip(): Promise<string | null>;
  uploadZip(filePath: string): Promise<UploadResult>;
  onStatement(cb: (s: XapiStatement) => void): () => void;
  onHttp(cb: (h: HttpLogEntry) => void): () => void;
  onTpInventory(cb: (entries: TpEntry[]) => void): () => void;
  kcLogin(): Promise<{ ok: boolean; error?: string }>;
  kcLogout(): Promise<{ ok: true }>;
  kcStatus(): Promise<KeycloakStatus>;
  listCtps(): Promise<Ctp[]>;
  listTeachingPoints(ctpId: string): Promise<TeachingPointRow[]>;
  onKcStatus(cb: (status: KeycloakStatus) => void): () => void;
}

declare global {
  interface Window {
    lms: LmsApi;
  }
}

export const lms: LmsApi = window.lms;
