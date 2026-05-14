import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { XapiActor, XapiStatement } from '../shared/types';
import { store } from './store';

const XAPI_VERSION = '1.0.3';

function setXapiHeaders(res: Response): void {
  res.setHeader('X-Experience-API-Version', XAPI_VERSION);
}

function agentKey(agent: unknown): string {
  if (!agent || typeof agent !== 'object') return 'unknown';
  const a = agent as XapiActor;
  if (a.mbox) return `mbox:${a.mbox}`;
  if (a.account) return `acc:${a.account.homePage}|${a.account.name}`;
  return `name:${a.name ?? 'unknown'}`;
}

function buildStateKey(query: Request['query']): string {
  const activityId = String(query.activityId ?? '');
  const stateId = String(query.stateId ?? '');
  const registration = String(query.registration ?? '');
  let agent: unknown = undefined;
  if (typeof query.agent === 'string') {
    try {
      agent = JSON.parse(query.agent);
    } catch {
      agent = query.agent;
    }
  }
  return `${activityId}|${agentKey(agent)}|${registration}|${stateId}`;
}

function buildProfileKey(
  query: Request['query'],
  kind: 'activity' | 'agent',
): string {
  const profileId = String(query.profileId ?? '');
  if (kind === 'activity') {
    const activityId = String(query.activityId ?? '');
    return `${activityId}|${profileId}`;
  }
  let agent: unknown = undefined;
  if (typeof query.agent === 'string') {
    try {
      agent = JSON.parse(query.agent);
    } catch {
      agent = query.agent;
    }
  }
  return `${agentKey(agent)}|${profileId}`;
}

export function createXapiRouter(): Router {
  const router = Router();

  router.use((_req, res, next) => {
    setXapiHeaders(res);
    next();
  });

  router.get('/about', (_req, res) => {
    res.json({ version: [XAPI_VERSION], extensions: {} });
  });

  router.post('/statements', (req, res) => {
    const ids = ingestStatements(req.body);
    res.status(200).json(ids);
  });

  router.put('/statements', (req, res) => {
    const queryId =
      typeof req.query.statementId === 'string'
        ? req.query.statementId
        : undefined;
    const body = req.body;
    if (queryId && body && typeof body === 'object' && !Array.isArray(body)) {
      (body as XapiStatement).id = queryId;
    }
    ingestStatements(body);
    res.status(204).end();
  });

  router.get('/statements', (req, res) => {
    const statementId =
      typeof req.query.statementId === 'string'
        ? req.query.statementId
        : undefined;
    if (statementId) {
      const found = store
        .getStatements()
        .find((s) => s.id === statementId);
      if (!found) {
        res.status(404).end();
        return;
      }
      res.json(found);
      return;
    }
    res.json({
      statements: store.getStatements(),
      more: '',
    });
  });

  router.get('/activities/state', (req, res) => {
    const key = buildStateKey(req.query);
    const value = store.getState(key);
    if (value === undefined) {
      res.status(404).end();
      return;
    }
    res.json(value);
  });

  router.put('/activities/state', (req, res) => {
    const key = buildStateKey(req.query);
    store.setState(key, req.body);
    res.status(204).end();
  });

  router.post('/activities/state', (req, res) => {
    const key = buildStateKey(req.query);
    const existing = store.getState(key);
    if (
      existing &&
      typeof existing === 'object' &&
      typeof req.body === 'object'
    ) {
      store.setState(key, { ...(existing as object), ...(req.body as object) });
    } else {
      store.setState(key, req.body);
    }
    res.status(204).end();
  });

  router.delete('/activities/state', (req, res) => {
    store.deleteState(buildStateKey(req.query));
    res.status(204).end();
  });

  for (const path of ['/activities/profile', '/agents/profile'] as const) {
    const kind: 'activity' | 'agent' =
      path === '/activities/profile' ? 'activity' : 'agent';

    router.get(path, (req, res) => {
      const key = buildProfileKey(req.query, kind);
      const value =
        kind === 'activity'
          ? store.getActivityProfile(key)
          : store.getAgentProfile(key);
      if (value === undefined) {
        res.status(404).end();
        return;
      }
      res.json(value);
    });

    router.put(path, (req, res) => {
      const key = buildProfileKey(req.query, kind);
      if (kind === 'activity') store.setActivityProfile(key, req.body);
      else store.setAgentProfile(key, req.body);
      res.status(204).end();
    });

    router.post(path, (req, res) => {
      const key = buildProfileKey(req.query, kind);
      const existing =
        kind === 'activity'
          ? store.getActivityProfile(key)
          : store.getAgentProfile(key);
      const merged =
        existing && typeof existing === 'object' && typeof req.body === 'object'
          ? { ...(existing as object), ...(req.body as object) }
          : req.body;
      if (kind === 'activity') store.setActivityProfile(key, merged);
      else store.setAgentProfile(key, merged);
      res.status(204).end();
    });

    router.delete(path, (req, res) => {
      const key = buildProfileKey(req.query, kind);
      if (kind === 'activity') store.deleteActivityProfile(key);
      else store.deleteAgentProfile(key);
      res.status(204).end();
    });
  }

  router.get('/activities', (req, res) => {
    const activityId =
      typeof req.query.activityId === 'string'
        ? req.query.activityId
        : 'unknown';
    res.json({
      id: activityId,
      objectType: 'Activity',
    });
  });

  router.get('/agents', (req, res) => {
    let agent: unknown = {};
    if (typeof req.query.agent === 'string') {
      try {
        agent = JSON.parse(req.query.agent);
      } catch {
        agent = {};
      }
    }
    res.json({
      ...(agent as object),
      objectType: 'Person',
    });
  });

  return router;
}

function ingestStatements(body: unknown): string[] {
  const incoming: XapiStatement[] = Array.isArray(body)
    ? (body as XapiStatement[])
    : body && typeof body === 'object'
      ? [body as XapiStatement]
      : [];
  const ids: string[] = [];
  for (const raw of incoming) {
    const id = raw.id ?? uuidv4();
    const persisted = store.addStatement({ ...raw, id });
    ids.push(persisted.id!);
  }
  return ids;
}
