import { randomBytes } from 'crypto';
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  type Event,
} from 'electron';
import { getApiConfig } from './config';
import {
  exchangeCodeForTokens,
  pkceVerifier,
  buildAuthorizeUrl,
  parseCallbackQuery,
  type KeycloakTokens,
} from './keycloak';

export class KeycloakLoginCancelled extends Error {
  constructor() {
    super('Login cancelled');
    this.name = 'KeycloakLoginCancelled';
  }
}

function callbackMatchesUrl(redirectUri: string, url: string): boolean {
  try {
    const u = new URL(url);
    const r = new URL(redirectUri);
    return u.origin === r.origin && u.pathname === r.pathname;
  } catch {
    return false;
  }
}

export async function loginInteractive(
  parent: BrowserWindow | null,
): Promise<KeycloakTokens> {
  const cfg = getApiConfig();
  if (!cfg.keycloakRealm) {
    throw new Error(
      'KEYCLOAK_REALM is not set. Add it to your .env file (e.g. KEYCLOAK_REALM=your-realm).',
    );
  }

  const codeVerifier = pkceVerifier();
  const state = randomBytes(16).toString('base64url');
  const authUrl = buildAuthorizeUrl(cfg, codeVerifier, state);

  const windowOpts: BrowserWindowConstructorOptions = {
    width: 520,
    height: 720,
    parent: parent ?? undefined,
    modal: !!parent,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      partition: `persist:keycloak-login-${randomBytes(4).toString('hex')}`,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'Sign in',
  };

  const win = new BrowserWindow(windowOpts);
  let finished = false;
  const redirectUri = cfg.keycloakRedirectUri;

  return new Promise<KeycloakTokens>((resolve, reject) => {
    const finishFail = (err: Error): void => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!win.isDestroyed()) win.close();
      reject(err);
    };

    const finishOk = (tokens: KeycloakTokens): void => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!win.isDestroyed()) win.close();
      resolve(tokens);
    };

    const onRedirect = (event: Event, url: string): void => {
      if (!callbackMatchesUrl(redirectUri, url)) return;
      event.preventDefault();
      void handleCallbackUrl(url);
    };

    const onNavigate = (_event: Event, url: string): void => {
      if (!callbackMatchesUrl(redirectUri, url)) return;
      void handleCallbackUrl(url);
    };

    async function handleCallbackUrl(url: string): Promise<void> {
      if (finished) return;
      const q = parseCallbackQuery(url);
      if (q.error) {
        finishFail(new Error(`${q.error}: ${q.errorDescription ?? ''}`.trim()));
        return;
      }
      if (!q.code || q.state !== state) {
        finishFail(
          new Error(
            'Invalid OAuth callback (missing code or state mismatch).',
          ),
        );
        return;
      }
      try {
        const tokens = await exchangeCodeForTokens(cfg, q.code, codeVerifier);
        finishOk(tokens);
      } catch (e) {
        finishFail(e instanceof Error ? e : new Error(String(e)));
      }
    }

    win.webContents.on('will-redirect', onRedirect);
    win.webContents.on('will-navigate', onNavigate);

    function cleanup(): void {
      win.webContents.removeListener('will-redirect', onRedirect);
      win.webContents.removeListener('will-navigate', onNavigate);
    }

    win.on('closed', () => {
      if (!finished) {
        cleanup();
        reject(new KeycloakLoginCancelled());
      }
    });

    void win
      .loadURL(authUrl)
      .then(() => win.show())
      .catch((e) =>
        finishFail(e instanceof Error ? e : new Error(String(e))),
      );
  });
}
