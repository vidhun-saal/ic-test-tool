import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  HttpLogEntry,
  PackageInfo,
  XapiStatement,
} from '../shared/types';

type StateKey = string;

interface StoreEvents {
  statement: (s: XapiStatement) => void;
  http: (h: HttpLogEntry) => void;
  packageChanged: (p: PackageInfo | null) => void;
}

export class Store extends EventEmitter {
  private statements: XapiStatement[] = [];
  private httpLog: HttpLogEntry[] = [];
  private state = new Map<StateKey, unknown>();
  private activityProfile = new Map<StateKey, unknown>();
  private agentProfile = new Map<StateKey, unknown>();
  private currentPackage: PackageInfo | null = null;

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
