export interface XapiActor {
  name?: string;
  mbox?: string;
  account?: {
    homePage: string;
    name: string;
  };
  objectType?: 'Agent' | 'Group';
}

export interface XapiVerb {
  id: string;
  display?: Record<string, string>;
}

export interface XapiObject {
  id?: string;
  objectType?: string;
  definition?: {
    name?: Record<string, string>;
    description?: Record<string, string>;
    type?: string;
  };
  [key: string]: unknown;
}

export interface XapiStatement {
  id?: string;
  actor: XapiActor;
  verb: XapiVerb;
  object: XapiObject;
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
  timestamp?: string;
  stored?: string;
  authority?: XapiActor;
  version?: string;
  [key: string]: unknown;
}

export interface HttpLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
}

export interface PackageInfo {
  id: string;
  originalName: string;
  extractedAt: string;
  entryPath: string;
  contentUrl: string;
}

export interface LaunchConfig {
  endpoint: string;
  auth: string;
  actor: XapiActor;
  activityId: string;
  registration: string;
}

export interface ServerInfo {
  port: number;
  baseUrl: string;
}

export interface UploadResult {
  ok: boolean;
  package?: PackageInfo;
  defaultLaunch?: LaunchConfig;
  error?: string;
}

export type TpSource = 'static' | 'live';

export interface TpEntry {
  raw: string;
  code?: string;
  name?: string;
  formatOk: boolean;
  formatReason?: string;
  sources: TpSource[];
  files?: string[];
  statementIds?: string[];
}

export interface ScannedTpHit {
  raw: string;
  file: string;
  line?: number;
}

export type KeycloakStatus =
  | { state: 'logged-out' }
  | {
      state: 'logged-in';
      username?: string;
      /** ISO expiry of access token */
      expiresAt: string;
    };

export interface Ctp {
  id: string;
  /** Resolved display name (BASE name if this CTP is non-BASE and has a parent) */
  name: string;
  code?: string;
  abbreviation?: string;
  type?: string;
  /** Parent BASE CTP id (for non-BASE CTPs) */
  parentCtpId?: string;
  /** Version inherited from the parent BASE CTP (when available) */
  version?: string | number;
}

export interface TeachingPointRow {
  toOrder?: number;
  eoOrder?: number;
  order?: number;
  [key: string]: unknown;
}

export const IPC = {
  GET_SERVER_INFO: 'lms:getServerInfo',
  UPLOAD_ZIP: 'lms:uploadZip',
  PICK_ZIP: 'lms:pickZip',
  GET_STATE: 'lms:getState',
  CLEAR_LOG: 'lms:clearLog',
  STATEMENT_EVENT: 'lms:statement',
  HTTP_EVENT: 'lms:http',
  TP_INVENTORY_EVENT: 'lms:tpInventory',
  KC_LOGIN: 'lms:kcLogin',
  KC_LOGOUT: 'lms:kcLogout',
  KC_STATUS: 'lms:kcStatus',
  LIST_CTPS: 'lms:listCtps',
  LIST_TEACHING_POINTS: 'lms:listTeachingPoints',
  KC_STATUS_EVENT: 'lms:kcStatusEvent',
} as const;

export interface AppState {
  serverInfo: ServerInfo;
  package: PackageInfo | null;
  statements: XapiStatement[];
  httpLog: HttpLogEntry[];
  tpInventory: TpEntry[];
}
