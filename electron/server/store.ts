import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { extractTpNameFromStatement, parseTpName } from '../shared/tpValidator';
import type {
  HttpLogEntry,
  PackageInfo,
  TpEntry,
  TpSource,
  XapiStatement,
} from '../shared/types';

type StateKey = string;

export interface UpsertTpInput {
  raw: string;
  source: TpSource;
  file?: string;
  statementId?: string;
}

interface StoreEvents {
  statement: (s: XapiStatement) => void;
  http: (h: HttpLogEntry) => void;
  packageChanged: (p: PackageInfo | null) => void;
  tp: (entries: TpEntry[]) => void;
}

function mergeSources(existing: TpSource[], next: TpSource): TpSource[] {
  if (existing.includes(next)) return existing;
  return [...existing, next];
}

function buildEntry(raw: string): TpEntry {
  const parsed = parseTpName(raw);
  return {
    raw,
    code: parsed.ok ? parsed.code : undefined,
    name: parsed.ok ? parsed.name : undefined,
    formatOk: parsed.ok,
    formatReason: parsed.ok ? undefined : parsed.reason,
    sources: [],
  };
}

export class Store extends EventEmitter {
  private statements: XapiStatement[] = [];
  private httpLog: HttpLogEntry[] = [];
  private state = new Map<StateKey, unknown>();
  private activityProfile = new Map<StateKey, unknown>();
  private agentProfile = new Map<StateKey, unknown>();
  private currentPackage: PackageInfo | null = null;
  /** Keyed by raw `definition.name.und` string */
  private tpInventory = new Map<string, TpEntry>();

  private static MAX_HTTP_LOG = 500;
  private static MAX_STATEMENTS = 1000;

  on<E extends keyof StoreEvents>(event: E, listener: StoreEvents[E]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  emit<E extends keyof StoreEvents>(
    event: E,
    ...args: Parameters<StoreEvents[E]>
  ): boolean {
    return super.emit(event, ...args);
  }

  private emitTpInventory(): void {
    this.emit('tp', this.getTpInventory());
  }

  getTpInventory(): TpEntry[] {
    return Array.from(this.tpInventory.values()).sort((a, b) =>
      a.raw.localeCompare(b.raw),
    );
  }

  clearTpInventory(): void {
    this.tpInventory.clear();
    this.emitTpInventory();
  }

  upsertTpEntry(input: UpsertTpInput): void {
    const { raw, source, file, statementId } = input;
    if (!raw || typeof raw !== 'string') return;

    let entry = this.tpInventory.get(raw);
    if (!entry) {
      entry = buildEntry(raw);
      this.tpInventory.set(raw, entry);
    } else {
      const parsed = parseTpName(raw);
      entry.code = parsed.ok ? parsed.code : undefined;
      entry.name = parsed.ok ? parsed.name : undefined;
      entry.formatOk = parsed.ok;
      entry.formatReason = parsed.ok ? undefined : parsed.reason;
    }

    entry.sources = mergeSources(entry.sources, source);

    if (source === 'static' && file) {
      const files = entry.files ?? [];
      if (!files.includes(file)) {
        entry.files = [...files, file];
      }
    }

    if (source === 'live' && statementId) {
      const ids = entry.statementIds ?? [];
      if (!ids.includes(statementId)) {
        entry.statementIds = [...ids, statementId];
      }
    }

    this.emitTpInventory();
  }

  addStatement(statement: XapiStatement): XapiStatement {
    const stored: XapiStatement = {
      ...statement,
      id: statement.id ?? uuidv4(),
      stored: statement.stored ?? new Date().toISOString(),
      timestamp: statement.timestamp ?? new Date().toISOString(),
      version: statement.version ?? '1.0.3',
    };
    this.statements.unshift(stored);
    if (this.statements.length > Store.MAX_STATEMENTS) {
      this.statements.length = Store.MAX_STATEMENTS;
    }
    this.emit('statement', stored);

    const und = extractTpNameFromStatement(stored);
    if (und) {
      this.upsertTpEntry({
        raw: und,
        source: 'live',
        statementId: stored.id,
      });
    }

    return stored;
  }

  getStatements(): XapiStatement[] {
    return this.statements.slice();
  }

  addHttpLog(entry: Omit<HttpLogEntry, 'id'>): HttpLogEntry {
    const full: HttpLogEntry = { ...entry, id: uuidv4() };
    this.httpLog.unshift(full);
    if (this.httpLog.length > Store.MAX_HTTP_LOG) {
      this.httpLog.length = Store.MAX_HTTP_LOG;
    }
    this.emit('http', full);
    return full;
  }

  getHttpLog(): HttpLogEntry[] {
    return this.httpLog.slice();
  }

  clearLog(): void {
    this.statements = [];
    this.httpLog = [];
  }

  setPackage(pkg: PackageInfo | null): void {
    this.clearTpInventory();
    this.currentPackage = pkg;
    this.emit('packageChanged', pkg);
  }

  getPackage(): PackageInfo | null {
    return this.currentPackage;
  }

  setState(key: StateKey, value: unknown): void {
    this.state.set(key, value);
  }

  getState(key: StateKey): unknown {
    return this.state.get(key);
  }

  deleteState(key: StateKey): boolean {
    return this.state.delete(key);
  }

  setActivityProfile(key: StateKey, value: unknown): void {
    this.activityProfile.set(key, value);
  }

  getActivityProfile(key: StateKey): unknown {
    return this.activityProfile.get(key);
  }

  deleteActivityProfile(key: StateKey): boolean {
    return this.activityProfile.delete(key);
  }

  setAgentProfile(key: StateKey, value: unknown): void {
    this.agentProfile.set(key, value);
  }

  getAgentProfile(key: StateKey): unknown {
    return this.agentProfile.get(key);
  }

  deleteAgentProfile(key: StateKey): boolean {
    return this.agentProfile.delete(key);
  }
}

export const store = new Store();
