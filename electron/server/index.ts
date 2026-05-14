import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import getPort from 'get-port';
import type { Server } from 'http';
import type { ServerInfo } from '../shared/types';
import { createXapiRouter } from './xapi';
import { createContentRouter } from './content';
import { store } from './store';

const SNIPPET_LIMIT = 4096;

function snippet(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  let str: string;
  if (typeof body === 'string') str = body;
  else if (Buffer.isBuffer(body)) str = body.toString('utf8');
  else {
    try {
      str = JSON.stringify(body);
    } catch {
      str = String(body);
    }
  }
  if (str.length > SNIPPET_LIMIT) {
    return str.slice(0, SNIPPET_LIMIT) + `… (${str.length - SNIPPET_LIMIT} more bytes)`;
  }
  return str;
}

function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  const reqHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') reqHeaders[k] = v;
    else if (Array.isArray(v)) reqHeaders[k] = v.join(', ');
  }

  let captured: string | undefined;
  const origJson = res.json.bind(res);
  const origSend = res.send.bind(res);
  res.json = (body: unknown) => {
    captured = snippet(body);
    return origJson(body);
  };
  res.send = (body: unknown) => {
    if (captured === undefined) captured = snippet(body);
    return origSend(body);
  };

  res.on('finish', () => {
    if (req.path.startsWith('/content/')) return;
    store.addHttpLog({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      requestHeaders: reqHeaders,
      requestBody: snippet(req.body),
      responseBody: captured,
    });
  });

  next();
}

export interface ServerHandle {
  info: ServerInfo;
  baseDir: string;
  stop: () => Promise<void>;
}

export async function startServer(baseDir: string): Promise<ServerHandle> {
  const port = await getPort({ port: getPort.makeRange(7000, 7999) });
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: false,
      allowedHeaders: '*',
      exposedHeaders: ['X-Experience-API-Version', 'Content-Type'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    }),
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(express.text({ type: ['text/*'], limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  app.use(loggingMiddleware);

  app.use('/xapi', createXapiRouter());
  app.use('/content', createContentRouter(baseDir, () => store.getPackage()?.id ?? null));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, port });
  });

  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });

  const info: ServerInfo = {
    port,
    baseUrl: `http://localhost:${port}`,
  };

  return {
    info,
    baseDir,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
