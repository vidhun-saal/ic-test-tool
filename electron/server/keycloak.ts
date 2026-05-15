import { createHash, randomBytes } from 'crypto';
import type { ApiConfig } from './config';

export interface KeycloakTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

function urlEncodeBody(params: Record<string, string>): URLSearchParams {
  const b = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) b.set(k, v);
  return b;
}

export function pkceVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthorizeUrl(
  cfg: ApiConfig,
  verifier: string,
  state: string,
): string {
  const challenge = pkceChallenge(verifier);
  const u = new URL(
    `${cfg.keycloakBaseUrl}/realms/${cfg.keycloakRealm}/protocol/openid-connect/auth`,
  );
  u.searchParams.set('client_id', cfg.keycloakClientId);
  u.searchParams.set('redirect_uri', cfg.keycloakRedirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', challenge);
  return u.toString();
}

export function parseCallbackQuery(redirectUrl: string): {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
  state: string | null;
} {
  try {
    const u = new URL(redirectUrl);
    return {
      code: u.searchParams.get('code'),
      error: u.searchParams.get('error'),
      errorDescription: u.searchParams.get('error_description'),
      state: u.searchParams.get('state'),
    };
  } catch {
    return {
      code: null,
      error: 'invalid_url',
      errorDescription: redirectUrl,
      state: null,
    };
  }
}

export async function exchangeCodeForTokens(
  cfg: ApiConfig,
  code: string,
  codeVerifier: string,
): Promise<KeycloakTokens> {
  const tokenEndpoint = `${cfg.keycloakBaseUrl}/realms/${cfg.keycloakRealm}/protocol/openid-connect/token`;
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: urlEncodeBody({
      grant_type: 'authorization_code',
      client_id: cfg.keycloakClientId,
      code,
      redirect_uri: cfg.keycloakRedirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const desc =
      typeof body === 'object' && body && 'error_description' in body
        ? String((body as { error_description?: unknown }).error_description)
        : text.slice(0, 300);
    throw new Error(`Token exchange failed (${res.status}): ${desc}`);
  }
  const o = body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const accessToken = o.access_token;
  const refreshToken = o.refresh_token;
  const expiresIn = o.expires_in;
  if (typeof accessToken !== 'string') {
    throw new Error('Missing access_token in token response');
  }
  return {
    accessToken,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
    expiresInSeconds: typeof expiresIn === 'number' ? expiresIn : 300,
  };
}

export async function refreshAccessToken(
  cfg: ApiConfig,
  refreshToken: string,
): Promise<KeycloakTokens> {
  const tokenEndpoint = `${cfg.keycloakBaseUrl}/realms/${cfg.keycloakRealm}/protocol/openid-connect/token`;
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: urlEncodeBody({
      grant_type: 'refresh_token',
      client_id: cfg.keycloakClientId,
      refresh_token: refreshToken,
    }).toString(),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Refresh returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Refresh failed (${res.status})`);
  }
  const o = body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const accessToken = o.access_token;
  const expiresIn = o.expires_in;
  if (typeof accessToken !== 'string') {
    throw new Error('Missing access_token in refresh response');
  }
  const newRefresh =
    typeof o.refresh_token === 'string' ? o.refresh_token : refreshToken;
  return {
    accessToken,
    refreshToken: newRefresh,
    expiresInSeconds: typeof expiresIn === 'number' ? expiresIn : 300,
  };
}
