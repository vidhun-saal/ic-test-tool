import { promises as fs } from 'fs';
import path from 'path';
import express, { Router } from 'express';
import extract from 'extract-zip';
import { v4 as uuidv4 } from 'uuid';
import type { PackageInfo } from '../shared/types';

const ENTRY_PREFERENCES = [
  'story.html',
  'story_html5.html',
  'index_lms.html',
  'index_lms_html5.html',
  'index.html',
];

export async function extractZip(
  zipPath: string,
  baseDir: string,
  originalName: string,
): Promise<PackageInfo> {
  await fs.mkdir(baseDir, { recursive: true });
  const id = uuidv4();
  const target = path.join(baseDir, id);
  await fs.mkdir(target, { recursive: true });
  await extract(zipPath, { dir: target });

  const entry = await findEntryPath(target);
  if (!entry) {
    throw new Error(
      'No HTML entry point found in the zip. Expected story.html, index.html, or similar.',
    );
  }

  return {
    id,
    originalName,
    extractedAt: new Date().toISOString(),
    entryPath: entry,
    contentUrl: `/content/${id}/${entry}`,
  };
}

async function findEntryPath(dir: string): Promise<string | null> {
  for (const pref of ENTRY_PREFERENCES) {
    if (await exists(path.join(dir, pref))) return pref;
  }
  const nested = await findFirstHtml(dir, dir, 3);
  return nested;
}

async function findFirstHtml(
  root: string,
  current: string,
  depth: number,
): Promise<string | null> {
  if (depth < 0) return null;
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const pref of ENTRY_PREFERENCES) {
    const candidate = entries.find(
      (e) => e.isFile() && e.name.toLowerCase() === pref,
    );
    if (candidate) {
      return path.relative(root, path.join(current, candidate.name));
    }
  }

  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.html')) {
      return path.relative(root, path.join(current, e.name));
    }
  }

  for (const e of entries) {
    if (e.isDirectory()) {
      const r = await findFirstHtml(root, path.join(current, e.name), depth - 1);
      if (r) return r;
    }
  }
  return null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function createContentRouter(
  baseDir: string,
  getCurrentId: () => string | null,
): Router {
  const router = Router();

  router.use('/:pkgId', (req, res, next) => {
    const pkgId = req.params.pkgId;
    const safe = /^[a-zA-Z0-9-]+$/.test(pkgId);
    if (!safe) {
      res.status(400).send('Invalid package id');
      return;
    }
    const dir = path.join(baseDir, pkgId);
    express.static(dir, {
      fallthrough: false,
      etag: false,
      cacheControl: false,
    })(req, res, next);
  });

  void getCurrentId;
  return router;
}

export async function cleanupBaseDir(baseDir: string): Promise<void> {
  try {
    await fs.rm(baseDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
