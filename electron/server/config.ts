/** URLs and Keycloak IDs — override via `.env` in project root (loaded from main entry). */

function trimTrailingSlash(base: string): string {
  return base.replace(/\/+$/, '');
}

export interface ApiConfig {
  keycloakBaseUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  keycloakRedirectUri: string;
  e2ApiBaseUrl: string;
}

export function loadApiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const keycloakBaseUrl = trimTrailingSlash(
    env.KEYCLOAK_BASE_URL ?? 'https://auth-dev-e2.saal.ai/auth',
  );
  const keycloakRealm = (env.KEYCLOAK_REALM ?? 'e2').trim();
  const keycloakClientId =
    env.KEYCLOAK_CLIENT_ID ?? 'e2-student-portal-sso';
  const keycloakRedirectUri =
    env.KEYCLOAK_REDIRECT_URI ?? 'http://localhost/oauth/callback';
  const e2ApiBaseUrl = trimTrailingSlash(
    env.E2_API_BASE_URL ?? 'https://dev-e2.saal.ai/e2-question-bank',
  );

  return {
    keycloakBaseUrl,
    keycloakRealm,
    keycloakClientId,
    keycloakRedirectUri,
    e2ApiBaseUrl,
  };
}

let cachedApiConfig: ApiConfig | null = null;

/** Call once at app startup after loading env */
export function setApiConfig(cfg: ApiConfig): void {
  cachedApiConfig = cfg;
}

export function getApiConfig(): ApiConfig {
  if (!cachedApiConfig) {
    throw new Error('API config not initialized');
  }
  return cachedApiConfig;
}