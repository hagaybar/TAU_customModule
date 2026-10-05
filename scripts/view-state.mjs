/**
 * view-state.mjs — what view is this session directed at, and does the work match it?
 *
 * The repository builds three views from one tree, and VIEW_ID in build-settings.env has
 * always decided which. The failure that motivated this is not choosing wrong at build time
 * though — it is being asked for "remove the logo", not knowing which view was meant, and
 * editing the wrong family's files. The build then succeeds, the view you cared about is
 * unchanged, and the other one is damaged.
 *
 * So VIEW_ID is promoted from "what to build" to **the session's declared view**: the
 * deterministic answer to which view an unqualified request meant. Changing it is an
 * explicit act (npm run view:use), never an inference.
 *
 * The family table is not duplicated here — select-view.mjs stays the one place a view maps
 * to a family. The change-classification primitives live in view-changes.mjs, which imports
 * nothing of ours, so that select-view.mjs can guard a build without importing this file
 * back.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { VIEW_FAMILY, familyFor, readViewId } from './select-view.mjs';
import { familyPaths, classifyAll, uncommittedFiles, SHARED_PATHS } from './view-changes.mjs';

export { VIEW_FAMILY, familyFor, familyPaths, SHARED_PATHS, uncommittedFiles };

const FAMILIES = Object.values(VIEW_FAMILY);

export function classifyForFamily(files, family) {
  return classifyAll(files, family, FAMILIES);
}

export function readEnv(root) {
  const envPath = path.join(root, 'build-settings.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const inst = (text.match(/^INST_ID=(.*)$/m) || [, ''])[1].trim();
  return { viewId: readViewId(text), instId: inst, text, path: envPath };
}

export const ARCHIVE_DIR = path.join(os.homedir(), 'tau-packages');

/** The most recent archived package for this view, from the manifest. */
export function lastBuild(instId, viewId, archiveDir = ARCHIVE_DIR) {
  const manifest = path.join(archiveDir, 'MANIFEST.tsv');
  if (!fs.existsSync(manifest)) return null;
  // Column 2 is the bare VIEW_ID, not <INST>-<VIEW> — that form appears only in the
  // filename. And the file predates its own header, so drop a header line only if one is
  // actually there rather than slicing a real row off the front.
  const rows = fs
    .readFileSync(manifest, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('built_utc\t'))
    .map((line) => line.split('\t'))
    .filter((cols) => cols[1] === viewId);
  if (rows.length === 0) return null;
  const [builtUtc, view, commit, dirty, bytes, file, note] = rows[rows.length - 1];
  return { builtUtc, view, commit, dirty: dirty === 'yes', bytes: Number(bytes), file, note: note || '' };
}

/** Files changed since that build: committed on top of it, plus anything uncommitted. */
export function changedSince(root, commit) {
  let committed = [];
  if (commit && commit !== 'nogit' && commit !== 'unknown') {
    try {
      committed = execFileSync('git', ['diff', '--name-only', `${commit}..HEAD`], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).split('\n').filter(Boolean);
    } catch {
      committed = [];     // the commit is not in this checkout; uncommitted work still counts
    }
  }
  return [...new Set([...committed, ...uncommittedFiles(root)])].sort();
}

export function summary(root, archiveDir = ARCHIVE_DIR) {
  const { viewId, instId } = readEnv(root);
  const family = familyFor(viewId);
  const build = lastBuild(instId, viewId, archiveDir);
  const since = build ? changedSince(root, build.commit) : [];
  return {
    viewId,
    instId,
    family,
    package: `${instId}-${viewId}`,
    editPaths: familyPaths(family),
    lastBuild: build,
    changedSinceBuild: classifyForFamily(since, family),
    uncommitted: classifyForFamily(uncommittedFiles(root), family),
  };
}
