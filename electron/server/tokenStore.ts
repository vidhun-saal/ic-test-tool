import { refreshAccessToken, type KeycloakTokens } from './keycloak';
import { getApiConfig } from './config';
import type { KeycloakStatus } from '../shared/types';

const REFRESH_MARGIN_MS = 60_000;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** absolute ms when access JWT expires (from server) */
  accessExpiryMs: number;
  username?: string;
}

let store: StoredTokens | null = null;

let notifyStatus: () => void = () => {};

export function setTokenStatusNotifier(fn: () => void): void {
  notifyStatus = fn;
}

function decodeUsername(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return undefined;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as {
      preferred_username?: string;
      email?: string;
      sub?: string;
    };
    return payload.preferred_username ?? payload.email ?? payload.sub;
  } catch {
    return undefined;
  }
}

export function getKeycloakStatus(): KeycloakStatus {
  if (!store) return { state: 'logged-out' };
  return {
    state: 'logged-in',
    username: store.username,
    expiresAt: new Date(store.accessExpiryMs).toISOString(),
  };
}

export function setTokens(tokens: KeycloakTokens): void {
  const accessExpiryMs =
    Date.now() + Math.max(30, tokens.expiresInSeconds) * 1000;
  store = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiryMs,
    username: decodeUsername(tokens.accessToken),
  };
  notifyStatus();
}

export function clearTokens(): void {
  store = null;
  notifyStatus();
}

export function markAccessPotentiallyStale(): void {
  if (store) {
    store.accessExpiryMs = 0;
  }
}

export async function getValidAccessToken(): Promise<string> {
  const cfg = getApiConfig();
  if (!store) {
    throw new Error('Not logged in');
  }

  const refreshIfBefore = store.accessExpiryMs - REFRESH_MARGIN_MS;
  if (Date.now() < refreshIfBefore) {
    return store.accessToken;
  }

  if (!store.refreshToken) {
    clearTokens();
    throw new Error('Session expired — sign in again');
  }

  try {
    const refreshed = await refreshAccessToken(cfg, store.refreshToken);
    const accessExpiryMs =
      Date.now() + Math.max(30, refreshed.expiresInSeconds) * 1000;
    store = {
      accessToken: refreshed.accessToken,
      refreshToken:
        refreshed.refreshToken || store.refreshToken,
      accessExpiryMs,
      username: decodeUsername(refreshed.accessToken),
    };
    notifyStatus();
    return refreshed.accessToken;
  } catch {
    clearTokens();
    throw new Error('Session expired — sign in again');
  }
}
